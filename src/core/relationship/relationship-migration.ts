// Relationship Engine v0.2 — migration adapter (pure).
// Seeds a nine-dimension vector from the legacy scalar { affinity, stageIndex }
// so upgrading a chat causes NO visible personality jump (MIGRATION_PLAN_v0.2
// §2, test M2). Idempotent at the call site via a stored schema version.

import type { RelationshipState } from './relationship-engine';
import {
  type RelationshipVector,
  type CharacterRelationshipPolicy,
  createInitialVector,
} from './relationship-vector';

export const RELATIONSHIP_SCHEMA_VERSION = 2;

// Legacy tier → seed vector. Tuned so projectStage(seed) does not fall below the
// legacy tier (verified in relationship-migration.test.ts). conflict/fear/
// dependence/romanticInterest seed to 0 — no legacy signal exists for them, so
// they must be earned post-migration rather than fabricated.
const TIER_SEEDS: Partial<RelationshipVector>[] = [
  { trust: 0.15, affection: 0.1, respect: 0.3, attachment: 0.05, familiarity: 0.1 }, // Stranger
  { trust: 0.3, affection: 0.25, respect: 0.35, attachment: 0.2, familiarity: 0.3 }, // Acquaintance
  { trust: 0.55, affection: 0.5, respect: 0.45, attachment: 0.45, familiarity: 0.55 }, // Companion / legacy Close
  { trust: 0.85, affection: 0.8, respect: 0.65, attachment: 0.82, familiarity: 0.8 }, // Intimate / legacy Devoted
];

// Map the legacy stageIndex (0..3 in DEFAULT_STAGES) onto a seed tier. Affinity
// is used only to nudge familiarity when stageIndex is unavailable.
const tierForLegacy = (state: RelationshipState): number => {
  const byStage = Math.min(TIER_SEEDS.length - 1, Math.max(0, Math.round(state.stageIndex)));
  return byStage;
};

export const seedVectorFromLegacy = (
  state: RelationshipState,
  transcriptLength = 0,
  policy?: CharacterRelationshipPolicy,
): RelationshipVector => {
  const tier = tierForLegacy(state);
  const seed = TIER_SEEDS[tier];
  // A long transcript is clearly familiar regardless of tier.
  const familiarityFloor = Math.min(1, transcriptLength / 400);
  const startingVector: Partial<RelationshipVector> = {
    ...seed,
    familiarity: Math.max(seed.familiarity ?? 0, familiarityFloor),
  };
  return createInitialVector({ ...policy, startingVector });
};

// Ensure a plausible vector exists for a chat, without re-seeding an already
// migrated one (idempotent — MIGRATION_PLAN §3, test M4).
export const ensureRelationshipVector = (input: {
  relationshipV2?: RelationshipVector;
  legacy: RelationshipState;
  transcriptLength?: number;
  policy?: CharacterRelationshipPolicy;
}): RelationshipVector =>
  input.relationshipV2 ??
  seedVectorFromLegacy(input.legacy, input.transcriptLength ?? 0, input.policy);
