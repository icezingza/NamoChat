# Migration Report — Relationship Engine v0.2 (Phase A implementation)

**Date:** 2026-07-09
**Scope:** Sprint 2 implementation of the multi-dimensional Relationship Engine, following the
approved design set in `docs/relationship/` and `docs/adr/ADR-0004`. This report records what was
built, how backward compatibility and gradual migration are guaranteed, and verification results.

## Constraints honored

| Rule | How it was met |
|---|---|
| 1. Do not modify UI | No files under `src/features/` or `src/components/` changed. |
| 2. Do not modify unrelated engines | Emotion, Memory, Identity, Soul, Lore, Timeline, Providers untouched. The v0.1 `relationship-engine.ts` was left intact; v0.2 is additive. Soul Core / prompt / context builders were **not** modified — v2 directives are folded in at the application (pipeline) layer. |
| 3. Backward compatibility | Flag defaults OFF ⇒ byte-for-byte v0.1 behavior. New `Chat` fields are optional. Legacy `relationship` is still advanced every turn. Existing 32 tests all pass. |
| 4. Behind a feature flag | `src/lib/feature-flags.ts` → `relationshipEngineV2` (default false; localStorage/opt-in override, no UI). |
| 5. Gradual migration | `relationship-migration.ts` seeds the vector lazily from legacy `{ affinity, stageIndex }` on first v2 turn; idempotent; legacy field retained. |

## Imported / new modules (all pure `core/` unless noted)

| File | Step | Responsibility |
|---|---|---|
| `src/core/relationship/relationship-vector.ts` | 1–2 | 9-dimension vector, config (all tunables), policy gates, `createInitialVector` |
| `src/core/relationship/relationship-events.ts` | 3 | Event taxonomy, weight scalars, delta templates, `effectiveDeltas` |
| `src/core/relationship/relationship-ledger.ts` | 3 | Append-only ledger helpers (immutable) |
| `src/core/relationship/relationship-core.ts` | 2–3 | `applyAmbient` (capped), `applyEvent` (weighted + couplings + gates), `replay` |
| `src/core/relationship/relationship-projection.ts` | 4 | `netBond`, stage/overlay/attachment projections (hysteresis), directives, `selectGreeting`, `relationshipBaselineBias`, v0.1 shim `toPersonaInputs` |
| `src/core/relationship/relationship-migration.ts` | 7 | Legacy → vector seeding, `ensureRelationshipVector` (idempotent) |
| `src/lib/feature-flags.ts` | — | `relationshipEngineV2` flag |
| `src/stores/relationship-runtime.ts` | 5–6 | Application glue: `advanceRelationship`, `commitRelationship`, `memoryToRelationshipEvent`, `edgeIdFor` |

## Modified modules (additive, backward compatible)

| File | Change |
|---|---|
| `src/stores/chat-store.ts` | Added optional `relationshipV2?` + `relationshipLedger?` to `Chat`; `forkChat` deep-copies them into the branch (B1). No change to existing fields. |
| `src/stores/chat-pipeline.ts` | Gated integration: when the flag is ON, advance the vector, override the relationship-derived persona directives (Step 6), and commit vector+ledger with memory-derived events (Step 5). Flag OFF ⇒ unchanged v0.1 path. |

## What changed conceptually

- The relationship is no longer a single `affinity`; when the flag is on, a **nine-dimension
  vector** (trust, affection, respect, attachment, dependence, familiarity, romanticInterest,
  conflict, fear) evolves **independently**.
- **Conversation is capped** (`applyAmbient`): only familiarity grows and conflict/fear decay; the
  sticky dimensions are untouched by chat. Meaningful change comes from **weighted events**.
- **Stage/attachment are now projections** with hysteresis and overlays (Rupture/Fearful/Obsessive/
  Estranged) — derived from the vector, not the source of truth.
- **Memory → Relationship**: high-salience / world memories emit memory-derived events.
- **Relationship → Prompt**: directives + narration tone + dimension notes ride the never-trimmed
  persona region.
- **Branch-safe**: the vector + ledger fork with the chat and diverge independently.

## Deliberately deferred (not this sprint)

- **Emotion Engine integration** — `relationshipBaselineBias` exists as a pure function but is NOT
  wired into the Emotion Engine (explicitly out of scope; "do not continue to Emotion Engine").
- **UI** — no relationship panel, no per-character policy field on the card, no greeting swap in the
  UI (Phase B/C per `MIGRATION_PLAN_v0.2.md`).
- **IndexedDB repository** and **text-based event detector** — Phase B/C.

## Verification

- **Existing tests:** all pass (no regressions).
- **New tests:** 41 added across `relationship-core.test.ts`, `relationship-projection.test.ts`,
  `relationship-migration.test.ts`, `relationship-runtime.test.ts`, `feature-flags.test.ts`.
- **Total:** **73/73 passing**, clean `tsc -b`, clean production build.
- **Invariants covered:** independence, weight/confidence scaling, diminishing returns, `[0,1]`
  bounds over a random stream, purity/determinism, gates (allowRomance/caps), betrayal asymmetry,
  ambient cap (200 neutral turns move no sticky dimension), monotonic familiarity, conflict/fear
  decay, netBond formula, band hysteresis + one-band regression, romantic relabel, overlay
  precedence, attachment order, replay = fold, memory-derived events, and **M2 no-personality-jump**
  seeding.
- **End-to-end (flag ON, headless browser):** a real turn persisted `relationshipV2` with all 9
  dimensions, familiarity advanced via the ambient update, the legacy `relationship` field was
  retained, and there were no console errors.

## Rollout state

Phase A of `MIGRATION_PLAN_v0.2.md` is implemented behind the flag (default OFF). Promotion to
default-on, Phase B (event detector + authoring UI), and Phase C (projections into greeting/emotion +
IndexedDB) are future sprints. **Stopping after the Relationship Engine, per instruction.**
