// Context Allocation Engine — the centralized budget/priority pipeline the
// context builder is now a thin wrapper over. Pure: no DOM/storage/LLM/network.
//
// Phase 4A Sprint 3: replaces the previous append-style composition with a
//   collect → rank → allocate → compose
// pipeline that classifies every section by tier (Mandatory / Protected /
// Optional), enforces a Memory Floor + Lore Cap, and keeps a Shared Optional
// Budget across memory + lore + recap. Selection priority is separate from
// display order: memory ranks above lore under budget pressure but keeps its
// original display position so generous-budget output is byte-for-byte
// preserved (backward compatibility).
//
// The pipeline emits an optional PromptSnapshot (kept + dropped sections +
// token counters) for debug and testing — it is never consumed as prompt text
// itself; only composePromptText produces the final string.

import type { TokenBudget } from './token-budget';

// ── types ───────────────────────────────────────────────────────────
export type SectionTier = 'mandatory' | 'protected' | 'optional';

export type SectionKind =
  | 'system-prompt' // budget-accounted, delivered separately to the provider
  | 'history' //     budget-accounted, delivered separately as chat history
  | 'persona-lock' // in-context, protected (never trimmed for consistency)
  | 'persona-block' // in-context, protected
  | 'story-recap' // in-context, optional
  | 'world-fact' // in-context, optional — alwaysActive lore
  | 'triggered-lore' // in-context, optional — keyword-triggered lore
  | 'memory'; //      in-context, optional — recalled memory

export interface ContextSection {
  readonly kind: SectionKind;
  readonly tier: SectionTier;
  readonly text: string;
  readonly priority: number; // selection priority — higher survives budget pressure first
  readonly displayOrder: number; // final placement in composed text (independent of priority)
}

export interface AllocationConfig {
  readonly memoryFloor: number; // min memory sections retained when at least this many exist
  readonly loreCap: number; // max lore entries admitted before allocation (world + triggered combined)
}

export const DEFAULT_ALLOCATION_CONFIG: AllocationConfig = Object.freeze({
  memoryFloor: 2,
  loreCap: 6,
});

// Debug/test-only view of an allocation decision. Never used as prompt text.
export interface PromptSnapshot {
  readonly kept: readonly ContextSection[];
  readonly dropped: readonly ContextSection[];
  readonly tokensUsed: number;
  readonly inputBudget: number;
  readonly config: AllocationConfig;
}

// ── collect ─────────────────────────────────────────────────────────
export interface CollectInput {
  systemPrompt: string;
  historyTexts: readonly string[];
  personaLock: string; // may be '' when a character has no consistencyRules
  personaBlock: string; // rendered by Soul Core (renderPersonaBlock)
  storyRecap: string;
  worldFacts: readonly string[]; // alwaysActive lore content strings
  triggeredLore: readonly string[]; // keyword-triggered lore content strings
  memories: readonly string[]; // recalled memory content strings
  config?: AllocationConfig;
}

// Turns raw inputs into a typed section list in DISPLAY order. The Lore Cap is
// applied here so downstream allocation and display are both bounded (world
// facts win admission over triggered lore when the cap bites).
export const collectSections = (input: CollectInput): ContextSection[] => {
  const config = input.config ?? DEFAULT_ALLOCATION_CONFIG;
  const worldFacts = input.worldFacts.slice(0, config.loreCap);
  const remainingCap = Math.max(0, config.loreCap - worldFacts.length);
  const triggered = input.triggeredLore.slice(0, remainingCap);

  const sections: ContextSection[] = [];
  let order = 0;

  sections.push({
    kind: 'system-prompt',
    tier: 'mandatory',
    text: input.systemPrompt,
    priority: 100,
    displayOrder: order++,
  });
  for (const text of input.historyTexts) {
    sections.push({ kind: 'history', tier: 'mandatory', text, priority: 95, displayOrder: order++ });
  }
  if (input.personaLock) {
    sections.push({
      kind: 'persona-lock',
      tier: 'protected',
      text: input.personaLock,
      priority: 90,
      displayOrder: order++,
    });
  }
  if (input.personaBlock) {
    sections.push({
      kind: 'persona-block',
      tier: 'protected',
      text: input.personaBlock,
      priority: 85,
      displayOrder: order++,
    });
  }

  // Optional band, display order matches the previous append-style output
  // (recap → world facts → triggered lore → memories) — preserved for
  // backward compatibility under generous budgets.
  if (input.storyRecap) {
    sections.push({
      kind: 'story-recap',
      tier: 'optional',
      text: `[Story so far]\n${input.storyRecap}`,
      priority: 50,
      displayOrder: order++,
    });
  }
  for (const text of worldFacts) {
    sections.push({
      kind: 'world-fact',
      tier: 'optional',
      text: `[World] ${text}`,
      priority: 40,
      displayOrder: order++,
    });
  }
  for (const text of triggered) {
    sections.push({
      kind: 'triggered-lore',
      tier: 'optional',
      text: `[World] ${text}`,
      priority: 30,
      displayOrder: order++,
    });
  }
  // Memory ranks HIGHER than lore in selection (priority = 60), but keeps its
  // trailing display position so unpressured output is unchanged.
  for (const text of input.memories) {
    sections.push({
      kind: 'memory',
      tier: 'optional',
      text: `[Memory] ${text}`,
      priority: 60,
      displayOrder: order++,
    });
  }
  return sections;
};

// ── rank (priority resolver) ────────────────────────────────────────
// Mandatory > Protected > Optional; within tier, higher `priority` wins.
// Returns a new array — inputs are never mutated.
const TIER_WEIGHT: Record<SectionTier, number> = { mandatory: 300, protected: 200, optional: 100 };

export const rankSections = (sections: readonly ContextSection[]): ContextSection[] =>
  [...sections].sort(
    (a, b) => TIER_WEIGHT[b.tier] + b.priority - (TIER_WEIGHT[a.tier] + a.priority),
  );

// ── allocate ───────────────────────────────────────────────────────
// Three-phase fit:
//   1. Mandatory + Protected are unconditionally kept (matches the historical
//      "mandatory set is never trimmed" guarantee of TokenBudget).
//   2. Memory Floor: up to `memoryFloor` memory sections fit before other
//      optional sections, so tight budgets can never starve memory.
//   3. Remaining optional sections fit by rank (memory > recap > world-fact
//      > triggered-lore) inside the Shared Optional Budget.
export interface AllocationResult {
  kept: ContextSection[];
  dropped: ContextSection[];
  tokensUsed: number;
}

export const allocate = (
  sections: readonly ContextSection[],
  budget: TokenBudget,
  config: AllocationConfig = DEFAULT_ALLOCATION_CONFIG,
): AllocationResult => {
  const ranked = rankSections(sections);
  const kept: ContextSection[] = [];
  const dropped: ContextSection[] = [];
  const inputBudget = budget.inputBudget;
  let used = 0;

  // Phase 1 — unconditional retention.
  for (const section of ranked) {
    if (section.tier === 'mandatory' || section.tier === 'protected') {
      kept.push(section);
      used += budget.estimateTokens(section.text);
    }
  }

  // Phase 2 — Memory Floor. Reserve up to `memoryFloor` memory sections and
  // fit them before other optional content so lore/recap cannot starve them.
  const memories = ranked.filter((section) => section.kind === 'memory');
  const reservedMemories = memories.slice(0, config.memoryFloor);
  const reservedSet = new Set(reservedMemories);
  for (const section of reservedMemories) {
    const cost = budget.estimateTokens(section.text);
    if (used + cost > inputBudget) {
      dropped.push(section);
      continue;
    }
    kept.push(section);
    used += cost;
  }

  // Phase 3 — Shared Optional Budget. Everything else in rank order.
  for (const section of ranked) {
    if (section.tier !== 'optional' || reservedSet.has(section)) continue;
    const cost = budget.estimateTokens(section.text);
    if (used + cost > inputBudget) {
      dropped.push(section);
      continue;
    }
    kept.push(section);
    used += cost;
  }

  return { kept, dropped, tokensUsed: used };
};

// ── compose ────────────────────────────────────────────────────────
// Emits the final prompt-context text: kept protected + optional sections,
// re-sorted into display order. The mandatory system prompt / history are
// delivered separately to the provider and never appear in the returned text —
// preserving the previous context-builder contract.
export const composePromptText = (kept: readonly ContextSection[]): string =>
  [...kept]
    .filter((section) => section.tier !== 'mandatory')
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((section) => section.text)
    .join('\n\n');
