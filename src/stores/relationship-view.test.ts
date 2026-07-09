// Phase 4A Sprint 1 — regression tests for the single-source-of-truth
// relationship flow: resolveRelationshipView is the ONE producer of the
// RelationshipView, and derivePersonaState consumes only that view.

import { describe, it, expect, afterEach } from 'vitest';
import { resolveRelationshipView, relationshipViewFromV1 } from './relationship-runtime';
import { derivePersonaState } from '../core/soul/soul-core';
import { RelationshipEngine, createInitialRelationship } from '../core/relationship/relationship-engine';
import { IdentityCapsule } from '../core/identity/identity-capsule';
import { createInitialAffect } from '../core/emotion/emotion-engine';
import { setFeatureOverride } from '../lib/feature-flags';

afterEach(() => setFeatureOverride('relationshipEngineV2', undefined));

const engine = new RelationshipEngine();
const affect = createInitialAffect();
const identity = new IdentityCapsule({ purpose: ['muse'], cognitiveStyle: [], emotionalSignature: [], consistencyRules: [] });
const baseChat = {
  relationship: createInitialRelationship(),
  relationshipV2: undefined,
  relationshipLedger: undefined,
  messages: [] as unknown[],
};
const signals = { toneScore: 0.5, conflictLevel: 0 };

describe('resolveRelationshipView — single producer', () => {
  it('flag OFF: returns the v1 scalar view and no commit turn', () => {
    setFeatureOverride('relationshipEngineV2', false);
    const state = createInitialRelationship();
    const resolved = resolveRelationshipView({
      chat: baseChat, relationshipState: state, relationshipEngine: engine, affect, signals,
    });
    expect(resolved.turn).toBeNull();
    // v1 view equals what the engine projects directly (no v2 fields).
    expect(resolved.view).toEqual(relationshipViewFromV1(state, engine, affect));
    expect(resolved.view.vector).toBeUndefined();
    expect(resolved.view.narrationTone).toBe('');
  });

  it('flag ON: returns the v2 projection view with a vector + commit turn', () => {
    setFeatureOverride('relationshipEngineV2', true);
    const resolved = resolveRelationshipView({
      chat: baseChat, relationshipState: baseChat.relationship, relationshipEngine: engine, affect, signals,
    });
    expect(resolved.turn).not.toBeNull();
    expect(resolved.view.vector).toBeDefined();       // nine-dim vector present
    expect(resolved.turn?.view).toBe(resolved.view);   // the turn and the view agree — one source
  });
});

describe('derivePersonaState consumes the view only', () => {
  it('maps every relationship field straight through from the view (no second source)', () => {
    const view = {
      stageName: 'Companion',
      stageDirective: 'be warm [candid] Narration: warm.',
      attachmentDirective: 'secure',
      narrationTone: 'warm',
      dimensionNotes: 'candid',
      overlay: 'Normal',
    };
    const persona = derivePersonaState({ identity, affect, relationship: view });
    expect(persona.stageName).toBe(view.stageName);
    expect(persona.stageDirective).toBe(view.stageDirective);   // NOT re-composed/merged
    expect(persona.attachmentDirective).toBe(view.attachmentDirective);
    expect(persona.narrationTone).toBe('warm');
    expect(persona.overlay).toBe('Normal');
    // moodLine/distilledIdentity still come from affect+identity fusion.
    expect(persona.moodLine).toContain('Current');
    expect(typeof persona.distilledIdentity).toBe('string');
  });
});

describe('backward compatibility (flag OFF is byte-for-byte the old v1 flow)', () => {
  it('persona stage/attachment equal the direct engine projection', () => {
    setFeatureOverride('relationshipEngineV2', false);
    const state = createInitialRelationship();
    const resolved = resolveRelationshipView({
      chat: baseChat, relationshipState: state, relationshipEngine: engine, affect, signals,
    });
    const persona = derivePersonaState({ identity, affect, relationship: resolved.view });
    const stage = engine.stageOf(state);
    const attachment = engine.attachmentStyleOf(state, affect.trust);
    expect(persona.stageName).toBe(stage.name);
    expect(persona.stageDirective).toBe(stage.promptModifier);
    expect(persona.attachmentDirective).toBe(attachment.promptDirective);
  });
});
