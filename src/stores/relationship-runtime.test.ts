import { describe, it, expect } from 'vitest';
import {
  advanceRelationship,
  commitRelationship,
  memoryToRelationshipEvent,
  edgeIdFor,
} from './relationship-runtime';
import type { MemoryRecordProps } from '../core/memory/memory-record';

const ctx = { edgeId: 'user->c:chat1', scopeId: 'chat1' };
const mem = (over: Partial<MemoryRecordProps>): MemoryRecordProps => ({
  id: 'm', chatId: 'chat1', role: 'user', content: 'x', emotionWeight: 0.5, timestamp: 1, ...over,
});

describe('memoryToRelationshipEvent (Memory → Relationship, Step 5)', () => {
  it('emits a minor event for a world fact', () => {
    const e = memoryToRelationshipEvent(mem({ role: 'world', content: 'she has a sister' }), ctx);
    expect(e?.weight).toBe('minor');
    expect(e?.source).toBe('memory-derived');
  });

  it('emits a moderate event for a high-emotion-weight memory', () => {
    const e = memoryToRelationshipEvent(mem({ emotionWeight: 0.85 }), ctx);
    expect(e?.weight).toBe('moderate');
  });

  it('returns null for an ordinary low-weight memory', () => {
    expect(memoryToRelationshipEvent(mem({ emotionWeight: 0.5 }), ctx)).toBeNull();
  });
});

describe('advanceRelationship / commitRelationship', () => {
  const chat = {
    relationship: { affinity: 0.5, stageIndex: 2 },
    relationshipV2: undefined,
    relationshipLedger: undefined,
    messages: new Array(10).fill(0),
  };

  it('seeds from legacy on first turn and yields persona directives', () => {
    const turn = advanceRelationship(chat, { toneScore: 0.5, conflictLevel: 0 });
    expect(turn.personaOverride.stageName).toBe('Companion');
    expect(turn.personaOverride.stageDirective).toContain('Narration:');
    expect(turn.ledger).toEqual([]);
  });

  it('familiarity advances via the capped ambient update', () => {
    const turn = advanceRelationship(chat, { toneScore: 0.5, conflictLevel: 0 });
    expect(turn.vector.familiarity).toBeGreaterThan(0);
  });

  it('commit applies a world-memory event and appends to the ledger', () => {
    const turn = advanceRelationship(chat, { toneScore: 0.5, conflictLevel: 0 });
    const before = turn.vector.attachment;
    const { relationshipV2, relationshipLedger } = commitRelationship(
      turn,
      [mem({ role: 'world' })],
      ctx,
    );
    expect(relationshipV2.attachment).toBeGreaterThan(before);
    expect(relationshipLedger).toHaveLength(1);
  });

  it('commit is a no-op on ordinary memories', () => {
    const turn = advanceRelationship(chat, { toneScore: 0.5, conflictLevel: 0 });
    const { relationshipLedger } = commitRelationship(turn, [mem({}), mem({ role: 'character' })], ctx);
    expect(relationshipLedger).toHaveLength(0);
  });
});

describe('edgeIdFor', () => {
  it('is a stable directed user→character edge per chat scope', () => {
    expect(edgeIdFor('char1', 'chatA')).toBe('user->char1:chatA');
  });
});
