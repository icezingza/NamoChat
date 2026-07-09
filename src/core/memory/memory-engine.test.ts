import { describe, expect, it } from 'vitest';
import { MemoryEngine } from './memory-engine';
import { MemoryRecord, calculateCosineSimilarity } from './memory-record';

const record = (id: string, content: string, chatId = 'chat1', weight = 0.5) => ({
  id,
  chatId,
  role: 'user' as const,
  content,
  emotionWeight: weight,
  timestamp: Number(id.replace(/\D/g, '')) || 1,
});

describe('MemoryRecord lifecycle', () => {
  it('auto-archives when weight drops below the threshold', () => {
    const memory = new MemoryRecord(record('m1', 'hello', 'c', 0.3));
    memory.adjustEmotionWeight(-0.15);
    expect(memory.state).toBe('ARCHIVED');
  });

  it('forget is terminal — archive() cannot resurrect', () => {
    const memory = new MemoryRecord(record('m1', 'hello'));
    memory.forget();
    memory.archive();
    expect(memory.state).toBe('FORGOTTEN');
  });
});

describe('MemoryEngine', () => {
  it('recalls lexically within a chat, including world memories', () => {
    const engine = new MemoryEngine();
    engine.remember(record('m1', 'we walked along the moonlit beach'));
    engine.remember({ ...record('m2', 'the beach house has a red door'), role: 'world', chatId: 'other' });
    engine.remember(record('m3', 'we argued about coffee', 'chat2'));

    const results = engine.recallLexical('chat1', 'beach');
    expect(results.map((r) => r.record.id).sort()).toEqual(['m1', 'm2']);
  });

  it('penalizes conflict turns and drops FORGOTTEN records on serialization', () => {
    const engine = new MemoryEngine();
    engine.remember(record('m1', 'a memory', 'chat1', 0.3));
    engine.evaluateInteraction(['m1'], { toneScore: 0, conflictLevel: 0.9 });
    expect(engine.toProps().find((p) => p.id === 'm1')?.state).toBe('ARCHIVED');

    engine.forgetChat('chat1');
    expect(engine.toProps()).toHaveLength(0);
  });

  it('pin raises weight and forgetOne drops the record from serialization', () => {
    const engine = new MemoryEngine();
    engine.remember(record('m1', 'a fond memory', 'chat1', 0.4));
    engine.pin('m1');
    expect(engine.toProps().find((p) => p.id === 'm1')?.emotionWeight).toBeCloseTo(0.7);

    engine.forgetOne('m1');
    expect(engine.toProps()).toHaveLength(0);
  });

  it('listFor returns active records newest-first', () => {
    const engine = new MemoryEngine();
    engine.remember(record('m1', 'first', 'chat1'));
    engine.remember(record('m9', 'ninth', 'chat1'));
    expect(engine.listFor('chat1').map((r) => r.id)).toEqual(['m9', 'm1']);
  });

  it('cosine similarity is safe on empty/mismatched vectors', () => {
    expect(calculateCosineSimilarity([], [1])).toBe(0);
    expect(calculateCosineSimilarity([1, 0], [1, 0])).toBe(1);
  });
});
