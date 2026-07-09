import { describe, it, expect } from 'vitest';
import {
  createInitialVector,
  DEFAULT_RELATIONSHIP_CONFIG as CFG,
  DIMENSIONS,
  type RelationshipVector,
} from './relationship-vector';
import { applyAmbient, applyEvent, replay } from './relationship-core';
import type { RelationshipEvent, EventWeight } from './relationship-events';

const vec = (over: Partial<RelationshipVector> = {}): RelationshipVector => ({
  trust: 0, affection: 0, respect: 0, attachment: 0, dependence: 0,
  familiarity: 0, romanticInterest: 0, conflict: 0, fear: 0, ...over,
});

const event = (type: string, weight: EventWeight = 'major', extra: Partial<RelationshipEvent> = {}): RelationshipEvent => ({
  id: 'e', edgeId: 'edge', scopeId: 'chat', timestamp: 1, type, weight, source: 'system', ...extra,
});

const neutral = { toneScore: 0.5, conflictLevel: 0 };

describe('createInitialVector', () => {
  it('uses baselines and applies policy.startingVector', () => {
    expect(createInitialVector().trust).toBe(CFG.baselines.trust);
    expect(createInitialVector({ startingVector: { familiarity: 0.4 } }).familiarity).toBe(0.4);
  });

  it('allowRomance:false clamps romanticInterest to 0 (gate)', () => {
    const v = createInitialVector({ allowRomance: false, startingVector: { romanticInterest: 0.9 } });
    expect(v.romanticInterest).toBe(0);
  });
});

describe('applyEvent', () => {
  it('moves only the event’s dimensions (independence)', () => {
    const before = createInitialVector();
    const after = applyEvent(before, event('compliment'));
    expect(after.affection).toBeGreaterThan(before.affection);
    expect(after.respect).toBeGreaterThan(before.respect);
    // untouched dims unchanged
    expect(after.trust).toBe(before.trust);
    expect(after.attachment).toBe(before.attachment);
    expect(after.fear).toBe(before.fear);
  });

  it('does not mutate the input and is deterministic (E2)', () => {
    const before = vec({ affection: 0.2 });
    const snapshot = { ...before };
    const a = applyEvent(before, event('gift'));
    const b = applyEvent(before, event('gift'));
    expect(before).toEqual(snapshot); // unmutated
    expect(a).toEqual(b); // deterministic
  });

  it('weight scales the delta (~pivotal:minor = 8:1)', () => {
    const base = vec({ affection: 0 });
    const minor = applyEvent(base, event('compliment', 'minor')).affection;
    const pivotal = applyEvent(base, event('compliment', 'pivotal')).affection;
    expect(pivotal / minor).toBeCloseTo(8, 1);
  });

  it('confidence scales the effect', () => {
    const base = vec();
    const full = applyEvent(base, event('gift', 'major', { confidence: 1 })).affection;
    const half = applyEvent(base, event('gift', 'major', { confidence: 0.5 })).affection;
    expect(half).toBeCloseTo(full / 2, 5);
  });

  it('has diminishing returns near the ceiling', () => {
    let v = vec({ affection: 0 });
    const first = applyEvent(v, event('compliment')).affection - v.affection;
    v = { ...v, affection: 0.9 };
    const near = applyEvent(v, event('compliment')).affection - v.affection;
    expect(near).toBeLessThan(first);
  });

  it('keeps every dimension in [0,1] over a random stream (E1)', () => {
    const types = ['gift', 'betrayal', 'confession_love', 'threat', 'apology', 'humiliation'];
    let v = createInitialVector();
    let seed = 7;
    for (let i = 0; i < 500; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const t = types[seed % types.length];
      const w = (['minor', 'moderate', 'major', 'pivotal'] as EventWeight[])[seed % 4];
      v = applyEvent(v, event(t, w));
      for (const d of DIMENSIONS) {
        expect(v[d]).toBeGreaterThanOrEqual(0);
        expect(v[d]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gate: allowRomance:false blocks romanticInterest even after confession_love', () => {
    const v = applyEvent(createInitialVector(), event('confession_love', 'pivotal'), { allowRomance: false });
    expect(v.romanticInterest).toBe(0);
  });

  it('dimensionCaps clamp after the event', () => {
    const v = applyEvent(vec({ dependence: 0.4 }), event('comfort_given', 'pivotal'), {
      dimensionCaps: { dependence: [0, 0.3] },
    });
    expect(v.dependence).toBeLessThanOrEqual(0.3);
  });

  it('betrayal asymmetry: trust drops fully, then rebuilds slowly while conflict is high', () => {
    const start = vec({ trust: 0.6 });
    const betrayed = applyEvent(start, event('betrayal', 'major'));
    expect(betrayed.trust).toBeLessThan(0.35); // large drop
    expect(betrayed.conflict).toBeGreaterThan(0.2);

    // Rebuild is damped while conflict is high vs. a calm baseline.
    const rebuildHot = applyEvent(betrayed, event('promise_kept', 'major')).trust - betrayed.trust;
    const calm = { ...betrayed, conflict: 0, fear: 0 };
    const rebuildCalm = applyEvent(calm, event('promise_kept', 'major')).trust - calm.trust;
    expect(rebuildHot).toBeLessThan(rebuildCalm);
  });
});

describe('applyAmbient (conversation is limited — P2/A1)', () => {
  it('200 neutral turns never move the sticky dimensions', () => {
    let v = createInitialVector({ startingVector: { trust: 0.5, respect: 0.5, attachment: 0.5, dependence: 0.4, romanticInterest: 0.3 } });
    const start = { ...v };
    for (let i = 0; i < 200; i++) v = applyAmbient(v, neutral);
    expect(v.trust).toBe(start.trust);
    expect(v.respect).toBe(start.respect);
    expect(v.attachment).toBe(start.attachment);
    expect(v.dependence).toBe(start.dependence);
    expect(v.romanticInterest).toBe(start.romanticInterest);
  });

  it('familiarity grows monotonically and saturates at 1 (F1)', () => {
    let v = createInitialVector();
    let prev = v.familiarity;
    for (let i = 0; i < 300; i++) {
      v = applyAmbient(v, neutral);
      expect(v.familiarity).toBeGreaterThanOrEqual(prev);
      prev = v.familiarity;
    }
    expect(v.familiarity).toBe(1);
  });

  it('conflict decays each turn; fear decays slower', () => {
    const after = applyAmbient(vec({ conflict: 0.8, fear: 0.8 }), neutral);
    expect(after.conflict).toBeCloseTo(0.6, 5); // 0.8 * (1 - 0.25)
    expect(after.fear).toBeCloseTo(0.76, 5); // 0.8 * (1 - 0.05)
    expect(after.fear).toBeGreaterThan(after.conflict);
  });

  it('a positive-tone turn nudges affection by less than ambientGain', () => {
    const after = applyAmbient(vec({ affection: 0.2 }), { toneScore: 1, conflictLevel: 0 });
    expect(after.affection - 0.2).toBeLessThan(CFG.ambientGain);
    expect(after.affection).toBeGreaterThan(0.2);
  });
});

describe('replay', () => {
  it('equals folding applyEvent over the ledger (R1)', () => {
    const seed = createInitialVector();
    const events = [event('gift'), event('secret_shared'), event('insult')];
    const folded = events.reduce((v, e) => applyEvent(v, e), { ...seed });
    expect(replay(seed, events)).toEqual(folded);
  });
});
