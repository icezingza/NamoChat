// Soul Core — the single fusion point that turns identity + affect + the
// relationship view into one PersonaState consumed by the Context Builder.
// Pure function of its inputs.
//
// Phase 4A Sprint 1: relationship enters through a single `RelationshipView`
// (the one source of truth), not through the RelationshipEngine directly. This
// removes the former dual-path flow (v1 fusion here + a v2 object-spread override
// in the pipeline). The view is produced once per turn by
// `stores/relationship-runtime.resolveRelationshipView`.

import { describeAffect, type AffectVector } from '../emotion/emotion-engine';
import type { IdentityCapsule } from '../identity/identity-capsule';
import type { RelationshipVector } from '../relationship/relationship-vector';

// The single relationship input to persona fusion. Produced from either the v1
// scalar (flag OFF) or the v2 projection (flag ON) so downstream has exactly one
// source. `narrationTone`/`dimensionNotes`/`overlay` are first-class (they used
// to be string-appended); `vector` is carried for future consumers and is
// undefined on the v1 path.
export interface RelationshipView {
  stageName: string;
  stageDirective: string;
  attachmentDirective: string;
  narrationTone: string;
  dimensionNotes: string;
  overlay: string;
  vector?: RelationshipVector;
}

export interface PersonaState {
  moodLine: string; // human-readable affect summary
  stageName: string;
  stageDirective: string; // stage prompt modifier
  attachmentDirective: string;
  narrationTone: string;
  dimensionNotes: string;
  overlay: string;
  distilledIdentity: string; // one-line persona reminder for this turn
}

export const derivePersonaState = (
  identity: IdentityCapsule,
  affect: AffectVector,
  relationship: RelationshipView,
): PersonaState => {
  const moodLine = `Current ${describeAffect(affect)}.`;

  return {
    moodLine,
    stageName: relationship.stageName,
    stageDirective: relationship.stageDirective,
    attachmentDirective: relationship.attachmentDirective,
    narrationTone: relationship.narrationTone,
    dimensionNotes: relationship.dimensionNotes,
    overlay: relationship.overlay,
    distilledIdentity: identity.getDistilledContext(moodLine),
  };
};
