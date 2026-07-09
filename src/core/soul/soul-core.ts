// Soul Core — the single persona-fusion point.
//
// Consolidation: identity + affect + the relationship view → one immutable
// PersonaState, and one function (renderPersonaBlock) that turns that state
// into the prompt block. All other code paths consume PersonaState fields as
// typed data; no persona-related string concatenation lives outside this file.
//
// Phase 4A Sprint 1: relationship became a single RelationshipView.
// Phase 4A Sprint 2: derivePersonaState is object-param; PersonaState is
// readonly + frozen; overlay/narrationTone/dimensionNotes are first-class
// fields rendered by renderPersonaBlock (no more folding into stageDirective).

import { describeAffect, type AffectVector } from '../emotion/emotion-engine';
import type { IdentityCapsule } from '../identity/identity-capsule';
import type { RelationshipVector } from '../relationship/relationship-vector';

// The single relationship input to persona fusion. Produced from either the v1
// scalar (flag OFF) or the v2 projection (flag ON) so downstream has exactly one
// source. `vector` is present only on the v2 path.
export interface RelationshipView {
  readonly stageName: string;
  readonly stageDirective: string;
  readonly attachmentDirective: string;
  readonly narrationTone: string;
  readonly dimensionNotes: string;
  readonly overlay: string;
  readonly vector?: RelationshipVector;
}

export interface PersonaState {
  readonly moodLine: string; // human-readable affect summary
  readonly stageName: string;
  readonly stageDirective: string; // stage prompt modifier — the directive alone, no folded extras
  readonly attachmentDirective: string;
  readonly narrationTone: string;
  readonly dimensionNotes: string;
  readonly overlay: string;
  readonly distilledIdentity: string; // one-line persona reminder for this turn
}

export interface DerivePersonaStateInput {
  identity: IdentityCapsule;
  affect: AffectVector;
  relationship: RelationshipView;
}

export const derivePersonaState = (input: DerivePersonaStateInput): PersonaState => {
  const { identity, affect, relationship } = input;
  const moodLine = `Current ${describeAffect(affect)}.`;

  return Object.freeze({
    moodLine,
    stageName: relationship.stageName,
    stageDirective: relationship.stageDirective,
    attachmentDirective: relationship.attachmentDirective,
    narrationTone: relationship.narrationTone,
    dimensionNotes: relationship.dimensionNotes,
    overlay: relationship.overlay,
    distilledIdentity: identity.getDistilledContext(moodLine),
  });
};

// The single persona assembly point. Every persona-related line the prompt
// carries is produced here from the typed PersonaState fields. Extra lines are
// only emitted when their field is non-empty / non-default, so an empty
// narration/notes/overlay (the v0.1 path) yields the exact block v0.1 produced.
export const renderPersonaBlock = (persona: PersonaState): string => {
  const lines: string[] = [
    `[Persona] ${persona.distilledIdentity}`,
    `[Relationship: ${persona.stageName}] ${persona.stageDirective} ${persona.attachmentDirective}`.trim(),
  ];
  if (persona.dimensionNotes) lines.push(`[Notes] ${persona.dimensionNotes}`);
  if (persona.narrationTone) lines.push(`[Narration] ${persona.narrationTone}`);
  if (persona.overlay && persona.overlay !== 'Normal') lines.push(`[Overlay] ${persona.overlay}`);
  return lines.join('\n');
};
