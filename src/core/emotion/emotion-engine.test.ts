import { describe, expect, it } from 'vitest';
import { applyDecay, createInitialAffect, updateAffect } from './emotion-engine';
import { extractSignals } from './signal-extractor';

describe('EmotionEngine', () => {
  it('starts at the neutral baseline', () => {
    const affect = createInitialAffect();
    expect(affect.valence).toBe(0.5);
    expect(affect.trust).toBe(0.5);
  });

  it('a single positive turn cannot swing the mood past inertia', () => {
    const next = updateAffect(createInitialAffect(), { toneScore: 1, conflictLevel: 0 });
    expect(next.valence).toBeGreaterThan(0.5);
    expect(next.valence).toBeLessThan(0.7); // 0.7 inertia caps the swing
  });

  it('conflict erodes trust and spikes arousal', () => {
    const next = updateAffect(createInitialAffect(), { toneScore: 0, conflictLevel: 1 });
    expect(next.trust).toBeLessThan(0.5);
    expect(next.arousal).toBeGreaterThan(0.5);
  });

  it('decay relaxes arousal/passion toward neutral but leaves trust sticky', () => {
    const excited = { valence: 0.9, arousal: 0.9, trust: 0.9, passion: 0.9, resonance: 0.9 };
    const decayed = applyDecay(excited);
    expect(decayed.arousal).toBeLessThan(0.9);
    expect(decayed.passion).toBeLessThan(0.9);
    expect(decayed.trust).toBe(0.9);
    expect(decayed.valence).toBe(0.9);
  });
});

describe('extractSignals', () => {
  it('reads affectionate text as high tone, no conflict', () => {
    const signals = extractSignals('I love you, you are beautiful');
    expect(signals.toneScore).toBeGreaterThan(0.6);
    expect(signals.conflictLevel).toBe(0);
  });

  it('reads hostile text as conflict', () => {
    const signals = extractSignals('I hate you, go away!');
    expect(signals.conflictLevel).toBeGreaterThanOrEqual(0.5);
    expect(signals.toneScore).toBeLessThan(0.5);
  });

  it('supports Thai keywords', () => {
    expect(extractSignals('คิดถึงนะ รักมาก').toneScore).toBeGreaterThan(0.6);
    expect(extractSignals('เกลียด ไปให้พ้น').conflictLevel).toBeGreaterThanOrEqual(0.5);
  });
});
