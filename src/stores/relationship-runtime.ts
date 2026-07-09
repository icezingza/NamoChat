// Application glue for the Relationship Engine v0.2. Orchestrates the pure core
// (migration → ambient → events → projection) for one turn. Only invoked by the
// chat pipeline when the `relationshipEngineV2` feature flag is ON; the v0.1
// scalar path is unchanged when the flag is OFF. Keeps the pure core free of
// store/DOM concerns (RELATIONSHIP_SEQUENCE_DIAGRAM §1).

import type { EmotionSignals } from '../core/emotion/emotion-engine';
import type { MemoryRecordProps } from '../core/memory/memory-record';
import type { RelationshipState } from '../core/relationship/relationship-engine';
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
  personaOverride: {
    stageName: string;
    stageDirective: string;
    attachmentDirective: string;
  };
}

// Pre-response: migrate/seed if needed, apply the capped ambient update, and
// build the relationship directives folded into the prompt (Step 6).
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
  const persona = toPersonaInputs(vector, previousStage);

  // Compact relationship conditioning appended to the stage directive so it
  // rides the never-trimmed persona region of the prompt.
  const extras = [
    persona.dimensionNotes ? `[${persona.dimensionNotes}]` : '',
    `Narration: ${persona.narrationTone}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    vector,
    ledger: chat.relationshipLedger ?? [],
    previousStage,
    personaOverride: {
      stageName: persona.stageName,
      stageDirective: [persona.stageDirective, extras].filter(Boolean).join(' '),
      attachmentDirective: persona.attachmentDirective,
    },
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
