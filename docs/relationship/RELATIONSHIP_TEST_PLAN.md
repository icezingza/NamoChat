# Relationship Engine — Test Plan (v0.2.0)

Design-only. Defines the test strategy that must be green before the Relationship Engine ships.
Runner: **Vitest**, fully offline (no network/LLM), consistent with the existing `core/**/*.test.ts`
suite. Tests target **public API only** (no private-field inspection). LLM/storage are injected, not
global (cross-cutting rule).

## 1. Coverage goals

- 100% of pure engine + projection branches (`relationship-engine`, `relationship-projection`,
  `relationship-events`).
- Every invariant in SPEC §10 and STATE_MACHINE §6 has ≥1 dedicated test.
- Repository & detector via contract tests over their adapters (like the donor
  `memory-repository.contract.spec`).

## 2. Unit — vector math (`relationship-engine`)

| # | Test | Asserts (invariant) |
|---|---|---|
| U1 | `createInitialVector` respects baselines and `policy.startingVector` | defaults + policy |
| U2 | `applyEvent` moves only the event's dimensions | independence (P1) |
| U3 | weight scaling: minor/moderate/major/pivotal give 0.25/0.5/1/2× | §4 weights |
| U4 | confidence scales effect linearly | §5.2 |
| U5 | diminishing returns: same event twice moves less the second time near a bound | resistance |
| U6 | any dimension stays in [0,1] over a random event stream (property test) | **E1** |
| U7 | `applyEvent` never mutates the input vector; identical inputs → identical output | **E2/API1** |
| U8 | gates last: `allowRomance:false` ⇒ romanticInterest stays 0 after a `confession_love` | **G1** |
| U9 | dimensionCaps clamp after events | §3.1 |
| U10 | betrayal asymmetry: trust drops full on `betrayal`, later positive trust deltas are damped while conflict high | §5.3 |
| U11 | fear masks affection in projection but preserves stored affection value | §5.3 |

## 3. Unit — ambient update (conversation is limited, P2)

| # | Test | Asserts |
|---|---|---|
| A1 | 200 neutral turns of `applyAmbient` leave trust/respect/attachment/romantic **unchanged** | **A1 (ambient cap)** — headline anti-regression test |
| A2 | `familiarity` grows monotonically and saturates at 1, never decreases | **F1** |
| A3 | `conflict` decays toward 0 each turn; `fear` decays slower | §5.1 rates |
| A4 | a positive tone turn nudges affection by < `AMBIENT_GAIN` | bounded nudge |
| A5 | ambient then event ordering: apology in the same turn resolves against decayed conflict | pipeline order |

## 4. Unit — couplings & config

| # | Test | Asserts |
|---|---|---|
| C1 | respect gate: romanticInterest decays when respect < 0.25 | §5.3 |
| C2 | dependence↑ + trust↓ raises Obsessive overlay (no numeric hack) | §5.3 |
| C3 | all tunables read from `RelationshipConfig`; overriding a constant changes behavior predictably | §9 |
| C4 | default config values are pinned (snapshot of the frozen defaults) | regression guard |

## 5. Unit — projections & state machine

| # | Test | Asserts (SM) |
|---|---|---|
| P1 | `netBond` formula matches SPEC §7.1 on fixed vectors | formula |
| P2 | stage bands map correctly at boundary values | ladder |
| P3 | hysteresis: crossing up at θ, not dropping until θ−H | **SM2** |
| P4 | one-band-per-eval regression on a large collapse | **SM2** |
| P5 | romantic relabel when romanticInterest ≥ 0.5 | §1 |
| P6 | overlay precedence Rupture > Fearful > Obsessive > Estranged > Normal | **SM3** |
| P7 | attachment-style decision order (fearful→possessive→avoidant→anxious→secure) | §4 |
| P8 | Estranged→Reconciling only via a repair event | triggers |
| P9 | projections are pure (input unchanged) | **SM1/C1** |
| P10 | worked-transition table (STATE_MACHINE §5) reproduced exactly | end-to-end projection |

## 6. Unit — replay, snapshots, branching

| # | Test | Asserts (B/S) |
|---|---|---|
| R1 | `replay(seed, events)` equals folding `applyEvent` (associativity of the ledger) | replay = live |
| R2 | replay to an intermediate `atMessageId` reconstructs that snapshot | §8 rewind |
| B1 | `forkScope` copies ledger up to fork; post-fork events don't affect the parent (and vice-versa) | **B1** |
| S1 | a snapshot's `vector` equals `edge.vector` after write | **DB3** |
| S2 | every state change has ≥1 ledger event (no silent mutation) | **S1** |

## 7. Contract — repository adapters

`describe.each` over `InMemoryRelationshipRepository` + `IndexedDBRelationshipRepository`
(fake-indexeddb in tests), mirroring the donor repository contract style:

- append/list events ordered by timestamp; append-only (updates rejected) — **DB2**.
- putSnapshot/latestSnapshot/listSnapshots round-trip.
- `forkScope` isolation — **B1**.
- `deleteScope` cascade, preserving parent events referenced by a live branch — **DB4**.
- storage-failure path: adapter degrades to in-memory, never throws (guarded) — parity with
  `MemoryRepository`.

## 8. Contract — event detector

- deterministic: same input → same events (no LLM) — offline.
- detects the core patterns (apology, threat, confession, gift, insult, betrayal) with expected
  type/weight/confidence < 1.
- neutral text → `[]` (no spurious events).
- recalled-memory context raises confidence (SPEC §5.4).
- ambiguous input stays low-weight (can't wreck a relationship).

## 9. Integration — pipeline (jsdom, mock provider)

Using the existing mock provider and stores:

- I1 send-message turn: ambient + detected events apply; edge/snapshot persisted **after** the reply.
- I2 failed/aborted request: **no** event, snapshot, or memory written (error text never persists).
- I3 regenerate/continue: no duplicate user-turn event; continue directive isn't detected as an event.
- I4 user-pinned pivotal event moves the vector and appears on the timeline.
- I5 memory-derived event fires when a high-emotion-weight/pinned memory is added (Memory→Relationship).
- I6 relationship directives ride the **never-trimmed** persona region under a tight `TokenBudget`
  (relationship conditioning survives budget pressure; optional memory/lore trimmed first).
- I7 greeting selection reflects the vector on a seeded/continued edge (Relationship→Greeting).
- I8 emotion baseline bias: high-attachment edge yields a warmer default affect (Relationship→Emotion).

## 10. Migration tests (see MIGRATION_PLAN_v0.2)

- M1 legacy `{ affinity, stageIndex }` chats load and seed a plausible vector (mapping table).
- M2 post-migration stage label ≈ pre-migration stage (no visible personality jump) — **priority #1
  guard**.
- M3 `ChatExport` v1 imports into v2 (relationship absent → seeded); v2 round-trips losslessly.
- M4 store `persist` version bump `migrate()` is idempotent and reversible-safe (no data loss on
  repeated runs).

## 11. Non-functional

- Determinism/property tests seeded (reproducible).
- Performance: `applyEvent`/projection are O(1); `replay` is O(events) — assert a large ledger
  (10k events) replays within a budget.
- No console errors; strict TypeScript; `npm test` stays fully offline.

## 12. Definition of done (engine may ship)

All of §2–§11 green, invariants covered, contract tests over both adapters pass, migration tests
green, and **M2 (no personality jump)** explicitly verified — never sacrifice character consistency.
