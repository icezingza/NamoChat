// Relationship Engine v0.2 — the pure update engine.
// applyAmbient (capped per-turn conversation effect), applyEvent (weighted
// event with diminishing returns + couplings + policy gates), and replay.
// All functions are pure: inputs are never mutated. See SPEC §5.

import type { EmotionSignals } from '../emotion/emotion-engine';
import {
  type RelationshipVector,
  type RelationshipConfig,
  type CharacterRelationshipPolicy,
  DEFAULT_RELATIONSHIP_CONFIG,
  applyPolicy,
  clampDimension as clamp01,
} from './relationship-vector';
import {
  type RelationshipEvent,
  WEIGHT_SCALARS,
  effectiveDeltas,
} from './relationship-events';

const clampMagnitude = (value: number, limit: number): number =>
  Math.min(limit, Math.max(-limit, value));

const decayToward = (value: number, target: number, rate: number): number =>
  value + (target - value) * rate;

// ── Per-turn ambient update ────────────────────────────────────────────────
// Conversation has *limited* effect by design (P2/A1): only familiarity grows,
// conflict/fear decay, and affection/conflict get a sub-budget nudge. The
// sticky dimensions (trust, respect, attachment, dependence, romanticInterest)
// are deliberately untouched — a long neutral chat cannot move them at all.
export const applyAmbient = (
  vector: RelationshipVector,
  signals: EmotionSignals,
  config: RelationshipConfig = DEFAULT_RELATIONSHIP_CONFIG,
): RelationshipVector => {
  const affectionNudge = clampMagnitude(
    (signals.toneScore - 0.5) * config.ambientGain,
    config.ambientBudget,
  );
  const conflictNudge = clampMagnitude(
    signals.conflictLevel * config.ambientGain,
    config.ambientBudget,
  );

  return {
    ...vector,
    familiarity: Math.min(1, vector.familiarity + config.familiarityStep),
    conflict: clamp01(decayToward(vector.conflict, 0, config.conflictDecay) + conflictNudge),
    fear: clamp01(decayToward(vector.fear, 0, config.fearDecay)),
    affection: clamp01(vector.affection + affectionNudge),
  };
};

// Cross-dimension couplings applied after raw deltas (SPEC §5.3).
const applyCouplings = (
  vector: RelationshipVector,
  config: RelationshipConfig,
): RelationshipVector => {
  const next = { ...vector };
  // Respect gates romantic depth: high romantic interest bleeds when respect is low.
  if (next.romanticInterest > 0.5 && next.respect < config.romanceRespectFloor) {
    next.romanticInterest = clamp01(next.romanticInterest - config.romanceRespectDecay);
  }
  return next;
};

// ── Single event application ───────────────────────────────────────────────
export const applyEvent = (
  vector: RelationshipVector,
  event: RelationshipEvent,
  policy?: CharacterRelationshipPolicy,
  config: RelationshipConfig = DEFAULT_RELATIONSHIP_CONFIG,
): RelationshipVector => {
  const scale = WEIGHT_SCALARS[event.weight] * (event.confidence ?? 1);
  const next: RelationshipVector = { ...vector };
  const deltas = effectiveDeltas(event);

  for (const key of Object.keys(deltas) as (keyof typeof deltas)[]) {
    const intended = deltas[key];
    if (intended == null) continue;
    const current = next[key];
    let delta: number;

    if (key === 'trust') {
      // Betrayal asymmetry: trust drops at full magnitude, rebuilds slowly and
      // is further damped while conflict/fear is high.
      if (intended < 0) {
        delta = intended * scale;
      } else {
        const rebuildFactor = 1 - Math.max(next.conflict, next.fear);
        delta = intended * scale * (1 - current) * rebuildFactor;
      }
    } else {
      // Diminishing returns: harder to raise a high value / lower a low one.
      const resistance = intended > 0 ? 1 - current : current;
      delta = intended * scale * resistance;
      // Attachment is very sticky downward (loss is felt slowly).
      if (key === 'attachment' && intended < 0) delta *= config.attachmentReleaseFactor;
    }

    next[key] = clamp01(current + delta);
  }

  return applyPolicy(applyCouplings(next, config), policy, config);
};

// Fold applyEvent over an ordered ledger to reconstruct any point (SPEC §8, R1).
export const replay = (
  seed: RelationshipVector,
  events: readonly RelationshipEvent[],
  policy?: CharacterRelationshipPolicy,
  config: RelationshipConfig = DEFAULT_RELATIONSHIP_CONFIG,
): RelationshipVector =>
  events.reduce((vector, event) => applyEvent(vector, event, policy, config), { ...seed });
