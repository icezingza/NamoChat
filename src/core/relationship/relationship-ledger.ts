// Relationship Engine v0.2 — append-only event ledger (pure).
// The ledger is the audit trail; state = seed ⊕ replay(ledger) (SPEC §8, S1).
// In Phase A the ledger lives inline on the chat; a repository adapter
// (IndexedDB) comes in a later phase without touching this pure layer.

import type { RelationshipEvent } from './relationship-events';

// Immutable append — never mutates the input (invariant: append-only, DB2).
export const appendEvent = (
  ledger: readonly RelationshipEvent[],
  event: RelationshipEvent,
): RelationshipEvent[] => [...ledger, event];

export const appendEvents = (
  ledger: readonly RelationshipEvent[],
  events: readonly RelationshipEvent[],
): RelationshipEvent[] => (events.length === 0 ? [...ledger] : [...ledger, ...events]);

export const eventsForEdge = (
  ledger: readonly RelationshipEvent[],
  edgeId: string,
): RelationshipEvent[] => ledger.filter((event) => event.edgeId === edgeId);

export const eventsSince = (
  ledger: readonly RelationshipEvent[],
  since: number,
): RelationshipEvent[] => ledger.filter((event) => event.timestamp > since);

// Ledger tail up to (and including) a message anchor — for replay/rewind to a
// timeline point (SPEC §8 rewind, branch fork).
export const eventsUpTo = (
  ledger: readonly RelationshipEvent[],
  atMessageId: string,
): RelationshipEvent[] => {
  const cutoff = ledger.findIndex((event) => event.atMessageId === atMessageId);
  return cutoff < 0 ? [...ledger] : ledger.slice(0, cutoff + 1);
};
