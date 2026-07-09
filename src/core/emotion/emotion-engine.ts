// Ported from darknamo-nexus-3 core/emotion/EmotionEngine.ts.
// Pure affect vector: no LLM call, no DOM/network/storage access.

export interface AffectVector {
  valence: number; // positivity/negativity of the mood
  arousal: number; // intensity/energy level
  trust: number; // accumulated trust over the chat
  passion: number; // depth of engagement
  resonance: number; // emotional alignment with the user
}

export interface EmotionSignals {
  toneScore: number; // 0..1, how positive/aligned the interaction reads
  conflictLevel: number; // 0..1, how much friction/negative arousal is present
}

// High inertia prevents abrupt mood swings from a single turn.
const INERTIA = 0.7;
// Fraction of the gap to neutral that arousal/passion close each idle turn.
const DECAY_RATE = 0.1;
const NEUTRAL = 0.5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const createInitialAffect = (): AffectVector => ({
  valence: NEUTRAL,
  arousal: NEUTRAL,
  trust: NEUTRAL,
  passion: NEUTRAL,
  resonance: NEUTRAL,
});

export const updateAffect = (current: AffectVector, signals: EmotionSignals): AffectVector => {
  const tone = clamp01(signals.toneScore);
  const conflict = clamp01(signals.conflictLevel);
  const blend = (previous: number, target: number) =>
    clamp01(INERTIA * previous + (1 - INERTIA) * target);

  return {
    valence: blend(current.valence, clamp01(tone * (1 - conflict))),
    arousal: blend(current.arousal, clamp01(conflict > 0 ? conflict : NEUTRAL * tone)),
    // Trust erodes with conflict and only slowly builds with good tone.
    trust: blend(current.trust, clamp01(current.trust + (tone - conflict) * 0.5)),
    // Engagement deepens with either strong positive tone or strong friction.
    passion: blend(current.passion, clamp01(Math.max(tone, conflict))),
    resonance: blend(current.resonance, clamp01(tone * (1 - conflict))),
  };
};

// Relax volatile dimensions toward neutral; trust/valence/resonance stay sticky.
export const applyDecay = (current: AffectVector): AffectVector => {
  const decayToward = (value: number) => clamp01(value + (NEUTRAL - value) * DECAY_RATE);
  return {
    valence: current.valence,
    arousal: decayToward(current.arousal),
    trust: current.trust,
    passion: decayToward(current.passion),
    resonance: current.resonance,
  };
};

export const describeAffect = (affect: AffectVector): string => {
  const level = (v: number) => (v >= 0.75 ? 'high' : v >= 0.45 ? 'moderate' : 'low');
  return (
    `mood ${level(affect.valence)} positivity, ${level(affect.arousal)} intensity, ` +
    `${level(affect.trust)} trust, ${level(affect.passion)} passion, ` +
    `${level(affect.resonance)} resonance`
  );
};
