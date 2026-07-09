// Application glue for the Relationship Engine v0.2. Orchestrates the pure core
// (migration → ambient → events → projection) for one turn. Only invoked by the
// chat pipeline when the `relationshipEngineV2` feature flag is ON; the v0.1
// scalar path is unchanged when the flag is OFF. Keeps the pure core free of
// store/DOM concerns (RELATIONSHIP_SEQUENCE_DIAGRAM §1).

import type { AffectVector, EmotionSignals } from '../core/emotion/emotion-engine';
import type { MemoryRecordProps } from '../core/memory/memory-record';
import type { RelationshipEngine, RelationshipState } from '../core/relationship/relationship-engine';
import {
  type RelationshipVector,
  type CharacterRelationshipPolicy,
  DEFAULT_RELATIONSHIP_CONFIG,
} from '../core/relationship/relationship-vector';
import type { RelationshipEvent } from '../core/relationship/relationship-events';
import { applyAmbient, applyEvent } from '../core/relationship/relationship-core';
import { appendEvents } from '../core/relationship/relationship-ledger';
import { ensureRelationshipVector } from '../core/relationship/relationship-migration';
import {
  toPersonaInputs,
  projectStage,
  type StageProjection,
} from '../core/relationship/relationship-projection';
import type { RelationshipView } from '../core/soul/soul-core';
import { isRelationshipV2Enabled } from '../lib/feature-flags';
import { generateId } from '../lib/utils';

export interface RelationshipEdgeContext {
  edgeId: string;
  scopeId: string; // chat id
  atMessageId?: string;
}

export const edgeIdFor = (characterId: string, chatId: string): string =>
  `user->${characterId}:${chatId}`;

export interface RelationshipTurn {
  vector: RelationshipVector; // after the capped ambient update
  ledger: RelationshipEvent[];
  previousStage: StageProjection;
  view: RelationshipView; // the single relationship input to persona fusion
}

// Pre-response: migrate/seed if needed, apply the capped ambient update, and
// build the RelationshipView folded into the prompt (Step 6).
export const advanceRelationship = (
  chat: {
    relationship: RelationshipState;
    relationshipV2?: RelationshipVector;
    relationshipLedger?: RelationshipEvent[];
    messages: unknown[];
  },
  signals: EmotionSignals,
  policy?: CharacterRelationshipPolicy,
): RelationshipTurn => {
  const seed = ensureRelationshipVector({
    relationshipV2: chat.relationshipV2,
    legacy: chat.relationship,
    transcriptLength: chat.messages.length,
    policy,
  });
  const previousStage = projectStage(seed);
  const vector = applyAmbient(seed, signals);
  // Sprint 2: renamed from `persona` — the projection helper returns the
  // relationship projection inputs, not a PersonaState. Soul Core owns
  // PersonaState; every field here flows straight through as typed data (no
  // persona-related string concatenation lives outside Soul Core).
  const projection = toPersonaInputs(vector, previousStage);

  return {
    vector,
    ledger: chat.relationshipLedger ?? [],
    previousStage,
    view: {
      stageName: projection.stageName,
      stageDirective: projection.stageDirective,
      attachmentDirective: projection.attachmentDirective,
      narrationTone: projection.narrationTone,
      dimensionNotes: projection.dimensionNotes,
      overlay: projection.stageProjection.overlay,
      vector,
    },
  };
};

// The v0.1 scalar path expressed as the same RelationshipView shape, so the
// persona-fusion seam has exactly ONE relationship input regardless of flag.
export const relationshipViewFromV1 = (
  state: RelationshipState,
  engine: RelationshipEngine,
  affect: AffectVector,
): RelationshipView => {
  const stage = engine.stageOf(state);
  const attachment = engine.attachmentStyleOf(state, affect.trust);
  return {
    stageName: stage.name,
    stageDirective: stage.promptModifier,
    attachmentDirective: attachment.promptDirective,
    narrationTone: '',
    dimensionNotes: '',
    overlay: 'Normal',
  };
};

export interface ResolvedRelationship {
  view: RelationshipView; // single source of truth for this turn
  turn: RelationshipTurn | null; // present only when v2 is active → used for commit
}

// Single producer of the per-turn RelationshipView. Reads the feature flag here
// (the only place), so the pipeline no longer branches on it or merges two
// relationship sources. v2 → advance + project; v1 → scalar view.
export const resolveRelationshipView = (params: {
  chat: {
    relationship: RelationshipState;
    relationshipV2?: RelationshipVector;
    relationshipLedger?: RelationshipEvent[];
    messages: unknown[];
  };
  relationshipState: RelationshipState; // v1-progressed state for this turn
  relationshipEngine: RelationshipEngine;
  affect: AffectVector;
  signals: EmotionSignals;
  policy?: CharacterRelationshipPolicy;
}): ResolvedRelationship => {
  if (isRelationshipV2Enabled()) {
    const turn = advanceRelationship(params.chat, params.signals, params.policy);
    return { view: turn.view, turn };
  }
  return {
    view: relationshipViewFromV1(params.relationshipState, params.relationshipEngine, params.affect),
    turn: null,
  };
};

// Memory → Relationship (Step 5). A memory saved with emotionWeight above the
// configured threshold, or an explicit world fact, emits a mild memory-derived
// event that deepens the bond. Ambiguous-valence auto memories are left to the
// Phase-B text detector; this deterministic path only reinforces high-salience
// shared memories. Returns null when the memory is not salient enough.
export const memoryToRelationshipEvent = (
  memory: MemoryRecordProps,
  ctx: RelationshipEdgeContext,
): RelationshipEvent | null => {
  const isWorld = memory.role === 'world';
  const isSalient = memory.emotionWeight >= DEFAULT_RELATIONSHIP_CONFIG.memoryEventThreshold;
  if (!isWorld && !isSalient) return null;

  return {
    id: generateId(),
    edgeId: ctx.edgeId,
    scopeId: ctx.scopeId,
    atMessageId: ctx.atMessageId,
    timestamp: Date.now(),
    type: 'memory_salient',
    weight: isWorld ? 'minor' : 'moderate',
    deltas: { attachment: 0.03, familiarity: 0.02, affection: 0.02 },
    source: 'memory-derived',
    note: isWorld ? 'shared world fact' : 'emotionally significant memory',
  };
};

// Post-response: apply any memory-derived events and append them to the ledger.
export const commitRelationship = (
  turn: RelationshipTurn,
  newMemories: MemoryRecordProps[],
  ctx: RelationshipEdgeContext,
  policy?: CharacterRelationshipPolicy,
): { relationshipV2: RelationshipVector; relationshipLedger: RelationshipEvent[] } => {
  const events = newMemories
    .map((memory) => memoryToRelationshipEvent(memory, ctx))
    .filter((event): event is RelationshipEvent => event !== null);

  const relationshipV2 = events.reduce(
    (vector, event) => applyEvent(vector, event, policy),
    turn.vector,
  );

  return {
    relationshipV2,
    relationshipLedger: appendEvents(turn.ledger, events),
  };
};
