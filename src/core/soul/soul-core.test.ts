// Phase 4A Sprint 2 — Soul Core is the single persona-fusion point.
// Asserts: object-param derivePersonaState, PersonaState immutability, first-
// class overlay/narrationTone/dimensionNotes fields, and renderPersonaBlock as
// the ONLY persona-assembly routine (no persona-related string concat elsewhere).

import { describe, it, expect } from 'vitest';
import { derivePersonaState, renderPersonaBlock, type RelationshipView } from './soul-core';
import { IdentityCapsule } from '../identity/identity-capsule';
import { createInitialAffect } from '../emotion/emotion-engine';

const identity = new IdentityCapsule({
  purpose: ['a muse'],
  cognitiveStyle: [],
  emotionalSignature: [],
  consistencyRules: [],
});
const affect = createInitialAffect();

const viewV1: RelationshipView = {
  stageName: 'Stranger',
  stageDirective: 'Keep distance.',
  attachmentDirective: 'Be cool.',
  narrationTone: '',
  dimensionNotes: '',
  overlay: 'Normal',
};

const viewV2: RelationshipView = {
  stageName: 'Companion',
  stageDirective: 'Show genuine affection.',
  attachmentDirective: 'Express feelings directly.',
  narrationTone: 'warm, intimate narration',
  dimensionNotes: 'candid',
  overlay: 'Normal',
};

describe('derivePersonaState — single object-param API', () => {
  it('accepts an object argument and returns every first-class field', () => {
    const p = derivePersonaState({ identity, affect, relationship: viewV2 });
    expect(p.stageName).toBe('Companion');
    expect(p.stageDirective).toBe('Show genuine affection.'); // directive alone — no folded extras
    expect(p.attachmentDirective).toBe('Express feelings directly.');
    expect(p.narrationTone).toBe('warm, intimate narration');
    expect(p.dimensionNotes).toBe('candid');
    expect(p.overlay).toBe('Normal');
    expect(p.moodLine).toContain('Current');
    expect(typeof p.distilledIdentity).toBe('string');
  });

  it('does not carry narration/notes inside stageDirective (Sprint 2 promotion)', () => {
    const p = derivePersonaState({ identity, affect, relationship: viewV2 });
    expect(p.stageDirective).not.toContain('Narration:');
    expect(p.stageDirective).not.toContain('[candid]');
  });
});

describe('PersonaState immutability', () => {
  it('is frozen at runtime — mutation is a no-op or throws in strict mode', () => {
    const p = derivePersonaState({ identity, affect, relationship: viewV2 });
    expect(Object.isFrozen(p)).toBe(true);
    // Vitest runs strict-mode modules, so this throws; either way, the field
    // value must not change.
    expect(() => {
      (p as { stageName: string }).stageName = 'HACKED';
    }).toThrow(TypeError);
    expect(p.stageName).toBe('Companion');
  });
});

describe('renderPersonaBlock — single persona-assembly point', () => {
  it('emits every first-class field when non-empty / non-default', () => {
    const block = renderPersonaBlock(derivePersonaState({ identity, affect, relationship: viewV2 }));
    expect(block).toContain('[Persona] '); // distilled identity line
    expect(block).toContain('[Relationship: Companion]');
    expect(block).toContain('Show genuine affection.');
    expect(block).toContain('Express feelings directly.');
    expect(block).toContain('[Notes] candid');
    expect(block).toContain('[Narration] warm, intimate narration');
    expect(block).not.toContain('[Overlay]'); // suppressed when 'Normal'
  });

  it('omits Notes/Narration/Overlay lines when their field is empty/Normal (v0.1 parity)', () => {
    const block = renderPersonaBlock(derivePersonaState({ identity, affect, relationship: viewV1 }));
    // Preserve the historical two-line shape ([Persona] + [Relationship: ...])
    // that the v0.1 flag-OFF path produced — backward compatibility guarantee.
    expect(block).toContain('[Persona] ');
    expect(block).toContain('[Relationship: Stranger] Keep distance. Be cool.');
    expect(block).not.toContain('[Notes]');
    expect(block).not.toContain('[Narration]');
    expect(block).not.toContain('[Overlay]');
  });

  it('emits the Overlay line for non-Normal overlays', () => {
    const rupture = { ...viewV2, overlay: 'Rupture' };
    const block = renderPersonaBlock(derivePersonaState({ identity, affect, relationship: rupture }));
    expect(block).toContain('[Overlay] Rupture');
  });
});

// Structural guard: no persona-related string concatenation lives outside of
// core/soul. The context builder and the relationship runtime must not
// template PersonaState fields themselves — they must use renderPersonaBlock
// and pass typed fields through, respectively. This test walks src/ and greps.
describe('no persona-related string assembly outside Soul Core', () => {
  const banned = [
    '[Persona]',
    '[Relationship:',
    'Narration:',
    'persona.stageDirective',
    'persona.distilledIdentity',
    'view.stageDirective',
  ];
  // Suffixes matched against the (test-file-relative) glob keys. Soul Core owns
  // persona strings; the listed test files use these literals deliberately as
  // fixtures / regression assertions.
  const allowedSuffixes = [
    'soul-core.ts',
    'soul-core.test.ts',
    'relationship-view.test.ts',
    'relationship-runtime.test.ts',
    'prompt.test.ts',
    'context-allocator.test.ts', // fixture literals for allocator regression tests
  ];

  it('no source file templates persona strings outside of core/soul', () => {
    // Vite/Vitest inlines the raw source of every matched file at build time
    // (no filesystem access at runtime); safe in the browser test environment.
    const sources = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const offenders: { file: string; needle: string }[] = [];
    for (const [file, text] of Object.entries(sources)) {
      if (allowedSuffixes.some((a) => file.endsWith(a))) continue;
      for (const needle of banned) if (text.includes(needle)) offenders.push({ file, needle });
    }
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});
