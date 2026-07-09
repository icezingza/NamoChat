// Relationship Engine v0.2 — event taxonomy + delta templates (pure).
// See RELATIONSHIP_ENGINE_SPEC.md §4. Events are the primary unit of change;
// conversation alone is capped (see relationship-core applyAmbient).

import type { Dimension } from './relationship-vector';

export type EventWeight = 'minor' | 'moderate' | 'major' | 'pivotal';
export type EventSource = 'user-pinned' | 'auto-detected' | 'memory-derived' | 'system';

export interface RelationshipEvent {
  id: string;
  edgeId: string;
  scopeId: string; // timeline / chat id
  atMessageId?: string;
  timestamp: number;
  type: string; // taxonomy key below, or a custom type carrying explicit deltas
  weight: EventWeight;
  deltas?: Partial<Record<Dimension, number>>; // overrides / augments the template
  source: EventSource;
  confidence?: number; // 0..1 for auto-detected; defaults to 1
  note?: string;
}

export const WEIGHT_SCALARS: Record<EventWeight, number> = {
  minor: 0.25,
  moderate: 0.5,
  major: 1,
  pivotal: 2,
};

// Default per-type intended deltas (pre-weight). Signs and magnitudes per SPEC §4.1.
export const EVENT_TEMPLATES: Record<string, Partial<Record<Dimension, number>>> = {
  compliment: { affection: 0.05, respect: 0.03 },
  gift: { trust: 0.03, affection: 0.08, attachment: 0.03 },
  comfort_given: { trust: 0.06, affection: 0.08, attachment: 0.05, dependence: 0.03, conflict: -0.05 },
  secret_shared: { trust: 0.1, affection: 0.04, attachment: 0.08 },
  vulnerability_shown: { trust: 0.08, affection: 0.06, respect: 0.03, attachment: 0.06 },
  promise_kept: { trust: 0.12, respect: 0.06, conflict: -0.05 },
  confession_love: { trust: 0.05, affection: 0.12, attachment: 0.1, romanticInterest: 0.2 },
  physical_intimacy: { trust: 0.04, affection: 0.08, attachment: 0.08, dependence: 0.04, romanticInterest: 0.15 },
  rescue: { trust: 0.15, affection: 0.1, respect: 0.12, attachment: 0.15, dependence: 0.08, conflict: -0.05, fear: -0.05 },
  sacrifice: { trust: 0.15, affection: 0.1, respect: 0.12, attachment: 0.15, dependence: 0.08, conflict: -0.05, fear: -0.05 },
  principled_stand: { trust: 0.05, respect: 0.15 },
  reunion: { trust: 0.02, affection: 0.06, attachment: 0.08, dependence: 0.05, conflict: -0.03 },
  apology: { trust: 0.05, affection: 0.03, respect: 0.03, conflict: -0.2, fear: -0.05 },
  forgiveness: { trust: 0.06, affection: 0.05, attachment: 0.03, conflict: -0.15, fear: -0.03 },
  insult: { trust: -0.04, affection: -0.06, respect: -0.08, conflict: 0.15 },
  rejection: { trust: -0.03, affection: -0.08, attachment: -0.03, romanticInterest: -0.1, conflict: 0.1 },
  boundary_violation: { trust: -0.1, affection: -0.05, respect: -0.08, conflict: 0.18, fear: 0.08 },
  lie_detected: { trust: -0.18, affection: -0.04, respect: -0.06, conflict: 0.12, fear: 0.03 },
  betrayal: { trust: -0.3, affection: -0.15, respect: -0.1, attachment: -0.05, conflict: 0.25, fear: 0.08 },
  threat: { trust: -0.08, affection: -0.05, conflict: 0.15, fear: 0.3 },
  aggression: { trust: -0.1, affection: -0.08, respect: -0.05, conflict: 0.2, fear: 0.35 },
  violence: { trust: -0.1, affection: -0.08, respect: -0.05, conflict: 0.2, fear: 0.35 },
  humiliation: { trust: -0.06, affection: -0.05, respect: -0.25, conflict: 0.15, fear: 0.05 },
};

export const eventTemplate = (type: string): Partial<Record<Dimension, number>> =>
  EVENT_TEMPLATES[type] ?? {};

// Template merged with any per-instance overrides. Instance deltas win per-dimension.
export const effectiveDeltas = (event: RelationshipEvent): Partial<Record<Dimension, number>> => ({
  ...eventTemplate(event.type),
  ...(event.deltas ?? {}),
});
