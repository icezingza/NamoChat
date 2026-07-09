// Memory Engine: long-term chat memory + world memory over MemoryRecord.
// Merges darknamo's MemoryRepository search behavior with a slimmed
// EvolutionEngine (reward/penalty weighting). Persistence is the caller's
// concern — this engine operates on plain record props in and out.

import {
  MemoryRecord,
  type MemoryRecordProps,
  type MemorySearchResult,
  searchMemoryRecords,
  searchSemanticMemories,
} from './memory-record';
import type { EmotionSignals } from '../emotion/emotion-engine';

const CONFLICT_PENALTY = -0.15;
const TONE_REWARD = 0.05;
const CONFLICT_THRESHOLD = 0.5;
const TONE_THRESHOLD = 0.7;

export class MemoryEngine {
  private records: MemoryRecord[];

  constructor(props: MemoryRecordProps[] = []) {
    this.records = props.map(MemoryRecord.fromProps);
  }

  remember(props: MemoryRecordProps): MemoryRecord {
    const record = new MemoryRecord(props);
    this.records.push(record);
    return record;
  }

  // Active memories for one chat, plus 'world' memories shared across chats.
  private activeFor(chatId: string): MemoryRecord[] {
    return this.records.filter(
      (r) => r.state === 'ACTIVE' && (r.chatId === chatId || r.role === 'world'),
    );
  }

  recallLexical(chatId: string, query: string, limit = 3): MemorySearchResult[] {
    return searchMemoryRecords(this.activeFor(chatId), query, limit);
  }

  recallSemantic(chatId: string, queryEmbedding: number[], limit = 3): MemorySearchResult[] {
    return searchSemanticMemories(this.activeFor(chatId), queryEmbedding, limit);
  }

  recallRecent(chatId: string, limit = 3): MemoryRecord[] {
    return this.activeFor(chatId)
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Slimmed EvolutionEngine: reward calm positive turns, penalize conflict.
  // Auto-archive on low weight is enforced inside MemoryRecord itself.
  evaluateInteraction(memoryIds: string[], signals: EmotionSignals): void {
    for (const id of memoryIds) {
      const record = this.records.find((r) => r.id === id);
      if (!record) continue;
      if (signals.conflictLevel >= CONFLICT_THRESHOLD) {
        record.adjustEmotionWeight(CONFLICT_PENALTY);
      } else if (signals.toneScore >= TONE_THRESHOLD) {
        record.adjustEmotionWeight(TONE_REWARD);
      }
    }
  }

  // Active memories for a chat, most recent first — for the inspector UI.
  listFor(chatId: string): MemoryRecord[] {
    return this.activeFor(chatId)
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  pin(id: string): void {
    this.records.find((r) => r.id === id)?.adjustEmotionWeight(0.3);
  }

  forgetOne(id: string): void {
    this.records.find((r) => r.id === id)?.forget();
  }

  forgetChat(chatId: string): void {
    for (const record of this.records) {
      if (record.chatId === chatId && record.role !== 'world') record.forget();
    }
  }

  // FORGOTTEN records are dropped at serialization time (donor-repo flush rule).
  toProps(): MemoryRecordProps[] {
    return this.records.filter((r) => r.state !== 'FORGOTTEN').map((r) => r.toProps());
  }
}
