import { describe, it, expect } from 'vitest';
import { seedVectorFromLegacy, ensureRelationshipVector } from './relationship-migration';
import { projectStage } from './relationship-projection';
import { createInitialVector } from './relationship-vector';

describe('seedVectorFromLegacy (no visible personality jump — M2)', () => {
  const expectedStageByTier = ['Stranger', 'Acquaintance', 'Companion', 'Intimate'];

  it('seeds each legacy tier to a plausible, non-downgraded stage', () => {
    expectedStageByTier.forEach((expected, stageIndex) => {
      const seed = seedVectorFromLegacy({ affinity: stageIndex * 0.3, stageIndex });
      expect(projectStage(seed).stage).toBe(expected);
    });
  });

  it('does not fabricate conflict, fear, dependence, or romance', () => {
    const seed = seedVectorFromLegacy({ affinity: 0.9, stageIndex: 3 });
    expect(seed.conflict).toBe(0);
    expect(seed.fear).toBe(0);
    expect(seed.dependence).toBe(0);
    expect(seed.romanticInterest).toBe(0);
  });

  it('floors familiarity by transcript length', () => {
    const seed = seedVectorFromLegacy({ affinity: 0, stageIndex: 0 }, 400);
    expect(seed.familiarity).toBe(1);
  });
});

describe('ensureRelationshipVector (idempotent — M4)', () => {
  it('returns the existing vector without re-seeding', () => {
    const existing = createInitialVector({ startingVector: { trust: 0.9 } });
    const out = ensureRelationshipVector({ relationshipV2: existing, legacy: { affinity: 0, stageIndex: 0 } });
    expect(out).toBe(existing); // same reference — not re-seeded
  });

  it('seeds from legacy when no v2 vector exists', () => {
    const out = ensureRelationshipVector({ relationshipV2: undefined, legacy: { affinity: 0.3, stageIndex: 1 } });
    expect(projectStage(out).stage).toBe('Acquaintance');
  });
});
