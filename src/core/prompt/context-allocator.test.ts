// Phase 4A Sprint 3 — Context Allocation Engine regression tests.
// Covers: tier classification (mandatory/protected/optional), the collect →
// rank → allocate → compose pipeline, Memory Floor, Lore Cap, Shared Optional
// Budget, and the PromptSnapshot returned by buildContextSnapshot.

import { describe, it, expect } from 'vitest';
import {
  allocate,
  collectSections,
  composePromptText,
  DEFAULT_ALLOCATION_CONFIG,
  rankSections,
} from './context-allocator';
import { buildContextSnapshot, type TurnContextInput } from './context-builder';
import { TokenBudget } from './token-budget';
import type { PersonaState } from '../soul/soul-core';
import type { LoreMatch } from '../lore/lore-engine';
import { MemoryRecord, type MemorySearchResult } from '../memory/memory-record';

const persona: PersonaState = Object.freeze({
  moodLine: 'calm',
  stageName: 'Stranger',
  stageDirective: 'Keep distance.',
  attachmentDirective: 'Be cool.',
  narrationTone: '',
  dimensionNotes: '',
  overlay: 'Normal',
  distilledIdentity: 'a muse',
});

const memoryResult = (id: string, content: string, at = 1): MemorySearchResult => ({
  record: new MemoryRecord({ id, chatId: 'c', role: 'user', content, emotionWeight: 0.5, timestamp: at }),
  score: 1,
});

const loreMatch = (id: string, content: string, key: string | null): LoreMatch => ({
  entry: { id, keys: key ? [key] : [], content, alwaysActive: key === null },
  matchedKey: key,
});

const baseInput = (over: Partial<TurnContextInput> = {}): TurnContextInput => ({
  persona,
  personaLock: '[lock] rule',
  memories: [],
  lore: [],
  storyRecap: '',
  budget: new TokenBudget({ maxTokens: 4000, reservedOutputTokens: 200 }),
  historyTexts: [],
  systemPrompt: 'sys',
  ...over,
});

// ── collect / classify ─────────────────────────────────────────────
describe('collectSections — tier classification', () => {
  it('classifies system-prompt/history as mandatory; persona-lock/block as protected; others optional', () => {
    const sections = collectSections({
      systemPrompt: 'sys',
      historyTexts: ['h1', 'h2'],
      personaLock: '[lock] rule',
      personaBlock: '[Persona] a muse',
      storyRecap: 'they met',
      worldFacts: ['sky is red'],
      triggeredLore: ['beach cursed'],
      memories: ['they danced'],
    });
    const byKind = Object.fromEntries(sections.map((s) => [s.kind, s.tier]));
    expect(byKind['system-prompt']).toBe('mandatory');
    expect(byKind.history).toBe('mandatory');
    expect(byKind['persona-lock']).toBe('protected');
    expect(byKind['persona-block']).toBe('protected');
    expect(byKind['story-recap']).toBe('optional');
    expect(byKind['world-fact']).toBe('optional');
    expect(byKind['triggered-lore']).toBe('optional');
    expect(byKind.memory).toBe('optional');
  });

  it('applies the Lore Cap at admission (world facts win, then triggered)', () => {
    const worldFacts = ['w1', 'w2', 'w3', 'w4'];
    const triggeredLore = ['t1', 't2', 't3', 't4'];
    const sections = collectSections({
      systemPrompt: '',
      historyTexts: [],
      personaLock: '',
      personaBlock: '',
      storyRecap: '',
      worldFacts,
      triggeredLore,
      memories: [],
      config: { memoryFloor: 0, loreCap: 5 },
    });
    const world = sections.filter((s) => s.kind === 'world-fact');
    const triggered = sections.filter((s) => s.kind === 'triggered-lore');
    expect(world).toHaveLength(4); // all four world facts fit under cap 5
    expect(triggered).toHaveLength(1); // only one triggered survives the cap
    expect(triggered[0].text).toContain('t1');
  });
});

// ── rank (priority resolver) ───────────────────────────────────────
describe('rankSections — priority resolver', () => {
  it('orders sections mandatory > protected > optional; memory above lore within optional', () => {
    const sections = collectSections({
      systemPrompt: 'sys',
      historyTexts: [],
      personaLock: '[lock]',
      personaBlock: '[Persona] p',
      storyRecap: '',
      worldFacts: ['w'],
      triggeredLore: ['t'],
      memories: ['m'],
    });
    const ranked = rankSections(sections);
    const order = ranked.map((s) => s.kind);
    // mandatory tier first, protected next, optional last
    expect(order.indexOf('system-prompt')).toBeLessThan(order.indexOf('persona-lock'));
    expect(order.indexOf('persona-lock')).toBeLessThan(order.indexOf('memory'));
    // within optional, memory outranks lore
    expect(order.indexOf('memory')).toBeLessThan(order.indexOf('world-fact'));
    expect(order.indexOf('world-fact')).toBeLessThan(order.indexOf('triggered-lore'));
  });

  it('does not mutate the input array', () => {
    const sections = collectSections({
      systemPrompt: 'sys', historyTexts: [], personaLock: '', personaBlock: '',
      storyRecap: '', worldFacts: [], triggeredLore: [], memories: ['m'],
    });
    const before = [...sections];
    rankSections(sections);
    expect(sections).toEqual(before);
  });
});

// ── allocate: mandatory + protected are unconditional ──────────────
describe('allocate — mandatory + protected unconditional', () => {
  it('keeps persona-lock and persona-block even when their cost busts the budget', () => {
    const budget = new TokenBudget({ maxTokens: 12, reservedOutputTokens: 10 }); // inputBudget=2
    const sections = collectSections({
      systemPrompt: 'sys', historyTexts: [], personaLock: '[lock] rule',
      personaBlock: '[Persona] a muse\n[Relationship: Stranger] Keep distance.',
      storyRecap: '', worldFacts: [], triggeredLore: [], memories: [],
    });
    const { kept, dropped } = allocate(sections, budget);
    const kinds = kept.map((s) => s.kind);
    expect(kinds).toContain('persona-lock');
    expect(kinds).toContain('persona-block');
    expect(dropped).toHaveLength(0);
  });

  it('drops oversized optional sections but keeps protected', () => {
    const budget = new TokenBudget({ maxTokens: 12, reservedOutputTokens: 10 });
    const sections = collectSections({
      systemPrompt: 'sys', historyTexts: [], personaLock: '[lock]',
      personaBlock: '', storyRecap: '', worldFacts: ['x'.repeat(400)],
      triggeredLore: [], memories: [],
    });
    const { kept, dropped } = allocate(sections, budget);
    expect(kept.map((s) => s.kind)).toContain('persona-lock');
    expect(dropped.map((s) => s.kind)).toContain('world-fact');
  });
});

// ── Memory Floor ───────────────────────────────────────────────────
describe('allocate — Memory Floor', () => {
  it('keeps up to memoryFloor memories even when lore would otherwise crowd them out', () => {
    // Budget lets ~3 short optional sections fit; there are 2 memories + 4 lore
    // entries. Without a floor, lore would take the slots (rank difference) —
    // with a floor, both memories survive.
    const budget = new TokenBudget({ maxTokens: 100, reservedOutputTokens: 10 });
    const sections = collectSections({
      systemPrompt: 's', historyTexts: [], personaLock: '', personaBlock: '',
      storyRecap: '', worldFacts: [], triggeredLore: [],
      memories: ['m1', 'm2'],
      config: { memoryFloor: 2, loreCap: 6 },
    });
    // Add oversized lore that would otherwise eat the whole budget:
    const heavy = collectSections({
      systemPrompt: '', historyTexts: [], personaLock: '', personaBlock: '',
      storyRecap: '', worldFacts: ['x'.repeat(60)], triggeredLore: [], memories: [],
      config: { memoryFloor: 0, loreCap: 6 },
    });
    const combined = [...sections, ...heavy];
    const { kept } = allocate(combined, budget, { memoryFloor: 2, loreCap: 6 });
    const memoryCount = kept.filter((s) => s.kind === 'memory').length;
    expect(memoryCount).toBe(2); // floor honored
  });

  it('does not fabricate memories — floor is capped by available count', () => {
    const budget = new TokenBudget({ maxTokens: 4000, reservedOutputTokens: 100 });
    const sections = collectSections({
      systemPrompt: 's', historyTexts: [], personaLock: '', personaBlock: '',
      storyRecap: '', worldFacts: ['w'], triggeredLore: [], memories: [], // no memories
      config: { memoryFloor: 3, loreCap: 6 },
    });
    const { kept } = allocate(sections, budget, { memoryFloor: 3, loreCap: 6 });
    expect(kept.filter((s) => s.kind === 'memory')).toHaveLength(0);
    expect(kept.map((s) => s.kind)).toContain('world-fact'); // world fact still fits
  });
});

// ── Lore Cap ───────────────────────────────────────────────────────
describe('allocate — Lore Cap', () => {
  it('never admits more than loreCap lore entries even with unlimited budget', () => {
    const budget = new TokenBudget({ maxTokens: 100_000, reservedOutputTokens: 100 });
    const worldFacts = Array.from({ length: 20 }, (_, i) => `w${i}`);
    const triggeredLore = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const sections = collectSections({
      systemPrompt: '', historyTexts: [], personaLock: '', personaBlock: '',
      storyRecap: '', worldFacts, triggeredLore, memories: [],
      config: { memoryFloor: 0, loreCap: 4 },
    });
    const loreCount =
      sections.filter((s) => s.kind === 'world-fact' || s.kind === 'triggered-lore').length;
    expect(loreCount).toBe(4);
    const { kept } = allocate(sections, budget, { memoryFloor: 0, loreCap: 4 });
    const keptLore = kept.filter((s) => s.kind === 'world-fact' || s.kind === 'triggered-lore');
    expect(keptLore).toHaveLength(4);
  });
});

// ── Shared Optional Budget ─────────────────────────────────────────
describe('allocate — Shared Optional Budget', () => {
  it('optional sections share the remaining budget after mandatory + protected', () => {
    const inputBudget = 300; // 320 - 20
    const budget = new TokenBudget({ maxTokens: 320, reservedOutputTokens: 20 });
    const long = 'x'.repeat(120); // ~30 tokens each
    const sections = collectSections({
      systemPrompt: '', historyTexts: [], personaLock: '', personaBlock: '',
      storyRecap: long, worldFacts: [long, long, long, long, long],
      triggeredLore: [], memories: [],
      config: { memoryFloor: 0, loreCap: 6 },
    });
    const { tokensUsed } = allocate(sections, budget, { memoryFloor: 0, loreCap: 6 });
    expect(tokensUsed).toBeLessThanOrEqual(inputBudget);
    // With ~30-token sections and budget 300, at most ~9 fit (they'd all fit).
    // Push budget lower and verify that not everything fits — the pool is shared.
    const tight = new TokenBudget({ maxTokens: 100, reservedOutputTokens: 20 }); // inputBudget=80
    const { kept: keptTight, dropped } = allocate(sections, tight, {
      memoryFloor: 0, loreCap: 6,
    });
    expect(dropped.length).toBeGreaterThan(0);
    expect(keptTight.length).toBeLessThan(sections.length);
  });
});

// ── compose ────────────────────────────────────────────────────────
describe('composePromptText', () => {
  it('emits protected + optional sections in display order; excludes mandatory', () => {
    const sections = collectSections({
      systemPrompt: 'SYSTEM',
      historyTexts: ['HISTORY'],
      personaLock: '[lock] rule',
      personaBlock: '[Persona] a muse',
      storyRecap: '',
      worldFacts: ['sky is red'],
      triggeredLore: [],
      memories: ['they danced'],
    });
    const budget = new TokenBudget({ maxTokens: 4000, reservedOutputTokens: 100 });
    const { kept } = allocate(sections, budget);
    const text = composePromptText(kept);
    expect(text).not.toContain('SYSTEM'); // mandatory omitted from context text
    expect(text).not.toContain('HISTORY');
    // Display order (persona-lock → persona-block → world → memory) preserved
    // even though memory ranks higher in selection.
    const iLock = text.indexOf('[lock] rule');
    const iBlock = text.indexOf('[Persona] a muse');
    const iWorld = text.indexOf('[World] sky is red');
    const iMemory = text.indexOf('[Memory] they danced');
    expect(iLock).toBeGreaterThanOrEqual(0);
    expect(iLock).toBeLessThan(iBlock);
    expect(iBlock).toBeLessThan(iWorld);
    expect(iWorld).toBeLessThan(iMemory);
  });
});

// ── PromptSnapshot / buildContextSnapshot ──────────────────────────
describe('buildContextSnapshot — debug view of the allocation decision', () => {
  it('returns the composed text alongside a kept/dropped/tokens/budget snapshot', () => {
    const { text, snapshot } = buildContextSnapshot(
      baseInput({
        memories: [memoryResult('m1', 'they danced')],
        lore: [loreMatch('l1', 'The beach is cursed.', 'beach')],
      }),
    );
    expect(text).toContain('The beach is cursed.');
    expect(text).toContain('they danced');
    expect(snapshot.kept.some((s) => s.kind === 'persona-lock')).toBe(true);
    expect(snapshot.kept.some((s) => s.kind === 'memory')).toBe(true);
    expect(snapshot.kept.some((s) => s.kind === 'triggered-lore')).toBe(true);
    expect(snapshot.dropped).toHaveLength(0);
    expect(snapshot.tokensUsed).toBeGreaterThan(0);
    expect(snapshot.inputBudget).toBe(3800);
    expect(snapshot.config).toEqual(DEFAULT_ALLOCATION_CONFIG);
  });

  it('populates `dropped` when a section cannot fit the shared optional budget', () => {
    const { snapshot } = buildContextSnapshot(
      baseInput({
        budget: new TokenBudget({ maxTokens: 12, reservedOutputTokens: 10 }),
        lore: [loreMatch('l1', 'x'.repeat(400), null)], // huge world fact
      }),
    );
    expect(snapshot.dropped.some((s) => s.kind === 'world-fact')).toBe(true);
    expect(snapshot.kept.some((s) => s.kind === 'persona-lock')).toBe(true); // protected survives
  });
});

// ── backward compatibility (existing behavior preserved) ──────────
describe('backward compatibility', () => {
  it('under generous budget, composed output matches the previous append order', () => {
    const { text } = buildContextSnapshot(
      baseInput({
        memories: [memoryResult('m1', 'they danced')],
        lore: [loreMatch('l1', 'sky is red', null), loreMatch('l2', 'The beach is cursed.', 'beach')],
        storyRecap: 'they met',
      }),
    );
    const iRecap = text.indexOf('[Story so far]');
    const iSky = text.indexOf('sky is red');
    const iBeach = text.indexOf('The beach is cursed.');
    const iMemory = text.indexOf('[Memory] they danced');
    // Previous order: recap → world fact → triggered lore → memory
    expect(iRecap).toBeGreaterThanOrEqual(0);
    expect(iRecap).toBeLessThan(iSky);
    expect(iSky).toBeLessThan(iBeach);
    expect(iBeach).toBeLessThan(iMemory);
  });
});
