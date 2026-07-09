// Context Builder: assembles the per-turn context block from the Soul Core
// persona state, recalled memories, lore matches and story recap — every
// insertion gated through TokenBudget (donor-repo rule: never append ungated
// context). Pure: takes data in, returns strings out.

import type { PersonaState } from '../soul/soul-core';
import type { MemorySearchResult } from '../memory/memory-record';
import type { LoreMatch } from '../lore/lore-engine';
import { TokenBudget } from './token-budget';

export interface TurnContextInput {
  persona: PersonaState;
  personaLock: string; // consistency rules — mandatory, never trimmed (priority 1)
  memories: MemorySearchResult[];
  lore: LoreMatch[];
  storyRecap: string; // from StoryTimeline.summarizeRecent
  budget: TokenBudget;
  historyTexts: string[]; // message history that will accompany the request
  systemPrompt: string;
}

export const buildTurnContext = (input: TurnContextInput): string => {
  // Mandatory blocks: persona lock (consistency) + persona reminder + stage
  // directives. These are small, bounded, and never dropped for budget.
  const personaBlock = [
    `[Persona] ${input.persona.distilledIdentity}`,
    `[Relationship: ${input.persona.stageName}] ${input.persona.stageDirective} ${input.persona.attachmentDirective}`,
  ].join('\n');
  const mandatoryBlocks = [input.personaLock, personaBlock].filter(Boolean);

  // Optional, priority-ordered candidates trimmed to the remaining budget.
  // Order = roleplay value: story recap, then always-active world facts, then
  // keyword-triggered lore, then recalled memories.
  const candidates: string[] = [];
  if (input.storyRecap) candidates.push(`[Story so far]\n${input.storyRecap}`);
  const alwaysActive = input.lore.filter((m) => m.matchedKey === null);
  const triggered = input.lore.filter((m) => m.matchedKey !== null);
  for (const match of [...alwaysActive, ...triggered]) {
    candidates.push(`[World] ${match.entry.content}`);
  }
  for (const result of input.memories) {
    candidates.push(`[Memory] ${result.record.content}`);
  }

  const mandatory = [input.systemPrompt, ...input.historyTexts, ...mandatoryBlocks];
  const kept = input.budget.selectWithinBudget(mandatory, candidates);

  return [...mandatoryBlocks, ...kept].join('\n\n');
};
