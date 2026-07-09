// Ported from darknamo-nexus-3 core/domain/MemoryRecord.ts, with the lifecycle
// discipline of sovereign-platform-v3's MemoryRecord aggregate (behavior methods
// only, no setters). Framework-free: no storage/DOM/LLM access here.

export type MemoryLifecycleState = 'ACTIVE' | 'ARCHIVED' | 'FORGOTTEN';

export interface MemoryRecordProps {
  id: string;
  chatId: string;
  role: 'user' | 'character' | 'world';
  content: string;
  state?: MemoryLifecycleState;
  emotionWeight: number;
  timestamp: number;
  lastAccessed?: number;
  embedding?: number[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const LOW_WEIGHT_ARCHIVE_THRESHOLD = 0.2;

export class MemoryRecord {
  readonly id: string;
  readonly chatId: string;
  readonly role: 'user' | 'character' | 'world';
  readonly content: string;
  readonly timestamp: number;
  readonly embedding?: number[];
  state: MemoryLifecycleState;
  emotionWeight: number;
  lastAccessed: number;

  constructor(props: MemoryRecordProps) {
    this.id = props.id;
    this.chatId = props.chatId;
    this.role = props.role;
    this.content = props.content;
    this.timestamp = props.timestamp;
    this.embedding = props.embedding;
    this.state = props.state ?? 'ACTIVE';
    this.emotionWeight = clamp01(props.emotionWeight);
    this.lastAccessed = props.lastAccessed ?? props.timestamp;
  }

  archive(): void {
    if (this.state === 'FORGOTTEN') return;
    this.state = 'ARCHIVED';
  }

  forget(): void {
    this.state = 'FORGOTTEN';
  }

  recordAccess(at: number): void {
    this.lastAccessed = at;
  }

  // Auto-archive below the threshold lives in the domain object so the
  // invariant holds regardless of caller (sovereign-platform rule).
  adjustEmotionWeight(delta: number): void {
    this.emotionWeight = clamp01(this.emotionWeight + delta);
    if (this.emotionWeight < LOW_WEIGHT_ARCHIVE_THRESHOLD) {
      this.archive();
    }
  }

  toProps(): MemoryRecordProps {
    return {
      id: this.id,
      chatId: this.chatId,
      role: this.role,
      content: this.content,
      state: this.state,
      emotionWeight: this.emotionWeight,
      timestamp: this.timestamp,
      lastAccessed: this.lastAccessed,
      embedding: this.embedding,
    };
  }

  static fromProps(props: MemoryRecordProps): MemoryRecord {
    return new MemoryRecord(props);
  }
}

export interface MemorySearchResult {
  record: MemoryRecord;
  score: number;
}

// Unicode-aware: keeps letters/digits of every script (Thai, CJK, Cyrillic,
// accented Latin, ...), not just ASCII + Thai.
const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (text: string) => new Set(normalizeText(text).split(' ').filter(Boolean));

const jaccardSimilarity = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

export const searchMemoryRecords = (
  records: MemoryRecord[],
  query: string,
  limit = 3,
): MemorySearchResult[] => {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return [];

  return records
    .map((record) => ({ record, score: jaccardSimilarity(queryTokens, tokenize(record.content)) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

// Returns 0 for empty, mismatched or zero-magnitude vectors so a bad/absent
// embedding ranks last instead of throwing.
export const calculateCosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length === 0 || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

export const searchSemanticMemories = (
  records: MemoryRecord[],
  queryEmbedding: number[],
  topK = 3,
): MemorySearchResult[] => {
  if (queryEmbedding.length === 0) return [];

  return records
    .filter((r) => r.state === 'ACTIVE' && r.embedding && r.embedding.length > 0)
    .map((record) => ({
      record,
      score: calculateCosineSimilarity(queryEmbedding, record.embedding as number[]),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};
