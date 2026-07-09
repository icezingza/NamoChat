// Relationship Engine v0.2 — vector model + config (pure, framework-free).
// Nine independent dimensions, each in [0,1]. See docs/relationship/
// RELATIONSHIP_ENGINE_SPEC.md §3 and RELATIONSHIP_API.md §2. No storage/DOM/LLM.

export type Dimension =
  | 'trust'
  | 'affection'
  | 'respect'
  | 'attachment'
  | 'dependence'
  | 'familiarity'
  | 'romanticInterest'
  | 'conflict'
  | 'fear';

export const DIMENSIONS: readonly Dimension[] = [
  'trust',
  'affection',
  'respect',
  'attachment',
  'dependence',
  'familiarity',
  'romanticInterest',
  'conflict',
  'fear',
];

export type RelationshipVector = Record<Dimension, number>;

export interface CharacterRelationshipPolicy {
  allowRomance?: boolean; // default true; false clamps romanticInterest to 0
  romanceGateTrust?: number; // romanticInterest capped until trust ≥ this threshold
  startingVector?: Partial<RelationshipVector>;
  dimensionCaps?: Partial<Record<Dimension, [number, number]>>;
}

export interface RelationshipConfig {
  baselines: RelationshipVector;
  familiarityStep: number; // per-turn familiarity growth (monotonic)
  conflictDecay: number; // fraction of conflict shed per turn
  fearDecay: number; // fraction of fear shed per turn (slower)
  ambientGain: number; // scale of the tiny per-turn affection/conflict nudge
  ambientBudget: number; // hard cap on any single ambient nudge
  attachmentReleaseFactor: number; // <1: attachment resists downward change
  romanceRespectDecay: number; // romanticInterest bleed when respect too low
  romanceRespectFloor: number; // respect below which romantic interest decays
  gatedRomanceCap: number; // romantic cap while below romanceGateTrust
  projectionWeights: {
    trust: number;
    affection: number;
    attachment: number;
    respect: number;
    familiarity: number;
    romanticInterest: number;
    conflictPenalty: number;
    fearPenalty: number;
    rupturePenaltyScale: number;
  };
  stageThresholds: [number, number, number, number]; // Acquaintance/Companion/Intimate/Devoted
  hysteresis: number; // band re-entry margin
  romanticThreshold: number; // romanticInterest ≥ this relabels the ladder
  memoryEventThreshold: number; // emotionWeight ≥ this emits a memory-derived event
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const BASELINES: RelationshipVector = {
  trust: 0.15,
  affection: 0.1,
  respect: 0.3,
  attachment: 0,
  dependence: 0,
  familiarity: 0,
  romanticInterest: 0,
  conflict: 0,
  fear: 0,
};

// All tunables live here; behavior changes only through this object (SPEC §9).
export const DEFAULT_RELATIONSHIP_CONFIG: RelationshipConfig = Object.freeze({
  baselines: BASELINES,
  familiarityStep: 0.01,
  conflictDecay: 0.25,
  fearDecay: 0.05,
  ambientGain: 0.02,
  ambientBudget: 0.02,
  attachmentReleaseFactor: 0.5,
  romanceRespectDecay: 0.05,
  romanceRespectFloor: 0.25,
  gatedRomanceCap: 0.3,
  projectionWeights: {
    trust: 0.3,
    affection: 0.2,
    attachment: 0.15,
    respect: 0.15,
    familiarity: 0.1,
    romanticInterest: 0.1,
    conflictPenalty: 0.6,
    fearPenalty: 0.7,
    rupturePenaltyScale: 0.5,
  },
  stageThresholds: [0.2, 0.45, 0.7, 0.88] as [number, number, number, number],
  hysteresis: 0.03,
  romanticThreshold: 0.5,
  memoryEventThreshold: 0.75,
});

export const clampDimension = clamp01;

// Apply character policy as the final, uncircumventable clamp (SPEC §3.1, G1).
export const applyPolicy = (
  vector: RelationshipVector,
  policy: CharacterRelationshipPolicy | undefined,
  config: RelationshipConfig = DEFAULT_RELATIONSHIP_CONFIG,
): RelationshipVector => {
  const next: RelationshipVector = { ...vector };
  if (policy?.allowRomance === false) {
    next.romanticInterest = 0;
  } else if (policy?.romanceGateTrust != null && next.trust < policy.romanceGateTrust) {
    next.romanticInterest = Math.min(next.romanticInterest, config.gatedRomanceCap);
  }
  if (policy?.dimensionCaps) {
    for (const dim of DIMENSIONS) {
      const cap = policy.dimensionCaps[dim];
      if (cap) next[dim] = Math.min(cap[1], Math.max(cap[0], next[dim]));
    }
  }
  for (const dim of DIMENSIONS) next[dim] = clamp01(next[dim]);
  return next;
};

export const createInitialVector = (
  policy?: CharacterRelationshipPolicy,
  config: RelationshipConfig = DEFAULT_RELATIONSHIP_CONFIG,
): RelationshipVector => {
  const seeded: RelationshipVector = { ...config.baselines, ...(policy?.startingVector ?? {}) };
  return applyPolicy(seeded, policy, config);
};
