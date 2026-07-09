// Context Builder — a thin wrapper over the Context Allocation Engine
// (context-allocator). Adapts the persona/memory/lore inputs into typed
// ContextSection[], runs collect → rank → allocate → compose, and returns the
// final prompt-context string. Pure: takes data in, returns strings out.
//
// Phase 4A Sprint 3: the previous append-style composition (mandatory blocks +
// selectWithinBudget over an ad-hoc candidates array) is replaced by the
// allocator. Persona assembly still lives in Soul Core (Sprint 2); this file
// composes only the outer block ordering and delegates sizing to the allocator.

import { renderPersonaBlock, type PersonaState } from '../soul/soul-core';
import type { MemorySearchResult } from '../memory/memory-record';
import type { LoreMatch } from '../lore/lore-engine';
import { TokenBudget } from './token-budget';
import {
  allocate,
  collectSections,
  composePromptText,
  DEFAULT_ALLOCATION_CONFIG,
  type AllocationConfig,
  type PromptSnapshot,
} from './context-allocator';

export interface TurnContextInput {
  persona: PersonaState;
  personaLock: string; // consistency rules — protected tier, never trimmed (priority 1)
  memories: MemorySearchResult[];
  lore: LoreMatch[];
  storyRecap: string; // from StoryTimeline.summarizeRecent
  budget: TokenBudget;
  historyTexts: string[]; // message history that accompanies the request (budget-accounted only)
  systemPrompt: string;
  allocationConfig?: AllocationConfig; // opt-in override; defaults preserve v0.1 behavior
}

// Split the raw TurnContextInput into the allocator's typed CollectInput. Kept
// in one place so both the composed-string path and the snapshot path use
// exactly the same collection.
const toCollectInput = (input: TurnContextInput) => {
  const personaBlock = renderPersonaBlock(input.persona);
  const worldFacts = input.lore
    .filter((match) => match.matchedKey === null)
    .map((match) => match.entry.content);
  const triggeredLore = input.lore
    .filter((match) => match.matchedKey !== null)
    .map((match) => match.entry.content);
  const memories = input.memories.map((result) => result.record.content);
  const config = input.allocationConfig ?? DEFAULT_ALLOCATION_CONFIG;
  return {
    systemPrompt: input.systemPrompt,
    historyTexts: input.historyTexts,
    personaLock: input.personaLock,
    personaBlock,
    storyRecap: input.storyRecap,
    worldFacts,
    triggeredLore,
    memories,
    config,
  };
};

export const buildTurnContext = (input: TurnContextInput): string => {
  const collected = toCollectInput(input);
  const sections = collectSections(collected);
  const { kept } = allocate(sections, input.budget, collected.config);
  return composePromptText(kept);
};

// Debug / test-only surface. Returns the full allocator decision (kept +
// dropped sections, token counters, config) alongside the composed text.
// Never used by production consumers — the chat pipeline calls buildTurnContext.
export interface ContextSnapshotResult {
  text: string;
  snapshot: PromptSnapshot;
}

export const buildContextSnapshot = (input: TurnContextInput): ContextSnapshotResult => {
  const collected = toCollectInput(input);
  const sections = collectSections(collected);
  const { kept, dropped, tokensUsed } = allocate(sections, input.budget, collected.config);
  const snapshot: PromptSnapshot = {
    kept,
    dropped,
    tokensUsed,
    inputBudget: input.budget.inputBudget,
    config: collected.config,
  };
  return { text: composePromptText(kept), snapshot };
};
