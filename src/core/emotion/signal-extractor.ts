// Lightweight keyword-based signal extraction (no LLM call), following the
// Unified_Moral_Layer / IntentAnalyzer approach from the donor repos:
// Thai + English keyword lists producing a { toneScore, conflictLevel } pair.

import type { EmotionSignals } from './emotion-engine';

const POSITIVE = [
  'love', 'like', 'beautiful', 'sweet', 'happy', 'thank', 'miss you', 'kiss', 'hold',
  'gentle', 'warm', 'adore', 'wonderful', 'amazing', 'stay',
  'รัก', 'ชอบ', 'คิดถึง', 'น่ารัก', 'ขอบคุณ', 'อบอุ่น', 'สวย', 'หอม', 'ดีใจ', 'มีความสุข',
];

const NEGATIVE = [
  'hate', 'angry', 'stupid', 'shut up', 'leave', 'go away', 'annoying', 'liar', 'never',
  'stop it', 'boring', 'ugly', 'wrong',
  'เกลียด', 'โกรธ', 'รำคาญ', 'ไปให้พ้น', 'โกหก', 'น่าเบื่อ', 'หุบปาก', 'เลิก',
];

const INTENSE = ['!', '!!', '?!', 'now', 'must', 'need you', 'เดี๋ยวนี้', 'ต้อง'];

const countHits = (text: string, keywords: string[]): number =>
  keywords.reduce((count, keyword) => (text.includes(keyword) ? count + 1 : count), 0);

export const extractSignals = (rawText: string): EmotionSignals => {
  const text = rawText.toLowerCase();
  const positives = countHits(text, POSITIVE);
  const negatives = countHits(text, NEGATIVE);
  const intensity = Math.min(1, countHits(text, INTENSE) * 0.25);

  // Neutral text reads as mildly positive engagement rather than cold silence.
  const base = 0.5;
  const toneScore = Math.min(1, Math.max(0, base + positives * 0.15 - negatives * 0.2));
  const conflictLevel = Math.min(1, negatives * 0.3 + (negatives > 0 ? intensity : 0));

  return { toneScore, conflictLevel };
};
