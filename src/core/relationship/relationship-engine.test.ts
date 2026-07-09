import { describe, expect, it } from 'vitest';
import {
  RelationshipEngine,
  createInitialRelationship,
} from './relationship-engine';

const warmAffect = { valence: 0.9, arousal: 0.6, trust: 0.95, passion: 0.9, resonance: 0.9 };
const coldAffect = { valence: 0.1, arousal: 0.7, trust: 0.05, passion: 0.1, resonance: 0.1 };

describe('RelationshipEngine', () => {
  it('progresses through stages over sustained warm turns', () => {
    const engine = new RelationshipEngine();
    let state = createInitialRelationship();
    for (let i = 0; i < 60; i++) state = engine.progress(state, warmAffect);
    expect(engine.stageOf(state).name).toBe('Devoted');
    expect(state.affinity).toBeGreaterThan(0.85);
  });

  it('a single warm turn does not jump stages', () => {
    const engine = new RelationshipEngine();
    const state = engine.progress(createInitialRelationship(), warmAffect);
    expect(engine.stageOf(state).name).toBe('Stranger');
  });

  it('cold turns erode affinity', () => {
    const engine = new RelationshipEngine();
    let state = { affinity: 0.5, stageIndex: 1 };
    for (let i = 0; i < 10; i++) state = engine.progress(state, coldAffect);
    expect(state.affinity).toBeLessThan(0.5);
  });

  it('attachment style follows the ported decision table', () => {
    const engine = new RelationshipEngine();
    expect(engine.attachmentStyleOf({ affinity: 1, stageIndex: 3 }, 0.9).name).toBe('possessive');
    expect(engine.attachmentStyleOf({ affinity: 0, stageIndex: 0 }, 0.1).name).toBe('avoidant');
    expect(engine.attachmentStyleOf({ affinity: 0.4, stageIndex: 1 }, 0.5).name).toBe('anxious');
    expect(engine.attachmentStyleOf({ affinity: 0.4, stageIndex: 1 }, 0.9).name).toBe('secure');
  });
});
