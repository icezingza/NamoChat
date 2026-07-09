# Migration Plan — Relationship Engine v0.1 → v0.2

Design-only. How to evolve the scalar relationship model into the nine-dimension engine **without
breaking existing chats or causing a visible personality jump** (priority #1). Non-destructive,
versioned, phased, and reversible-safe.

## 0. Current state (what we migrate from)

- `RelationshipState = { affinity: number, stageIndex: number }`, stored inline on every persisted
  `Chat` via Zustand `persist` (one `localStorage` blob).
- `RelationshipEngine.progress/stageOf/attachmentStyleOf` consumed by `soul-core.derivePersonaState`
  → `context-builder` → prompt.
- `forkChat` already snapshots relationship (and affect/memory/timeline) into a branch.
- `ChatExport { version: 1 }`.

## 1. Compatibility strategy (non-breaking)

The migration is designed so the app **keeps working at every step**:

- **Keep the read seam stable.** Introduce the compatibility shim (`toPersonaInputs`, API §4.1) that
  produces the exact `{ stageName, stageDirective, attachmentDirective }` shape `soul-core`
  consumes. `soul-core`/`context-builder` change **last** (or not at all in Phase A).
- **Dual-write, single-read window.** During rollout the new `RelationshipVector` is the source of
  truth; the legacy `stageIndex` is still derived for any code/tests not yet switched.
- **Version everything.** Bump the Zustand `persist` version and `ChatExport` version; provide
  `migrate()` that is **idempotent** (safe to run repeatedly) and never deletes legacy data until a
  later, explicit cleanup phase.

## 2. Legacy → vector seeding map (the critical correctness step)

On first load of a legacy chat, seed a plausible vector from `affinity` (and stage) so the character
doesn't lurch. Mapping (tuned so `projectStage(seed) == legacy stage`, verified by test M2):

| Legacy affinity band (stage) | Seeded vector (approx) |
|---|---|
| `< 0.20` (Stranger) | trust .15, affection .10, respect .30, attachment .05, familiarity .10, rest 0 |
| `0.20–0.45` (Acquaintance) | trust .30, affection .25, respect .35, attachment .20, familiarity .30 |
| `0.45–0.70` (Companion/Close) | trust .55, affection .50, respect .45, attachment .45, familiarity .55 |
| `0.70–0.88` (Intimate) | trust .70, affection .65, respect .55, attachment .65, familiarity .70 |
| `≥ 0.88` (Devoted) | trust .82, affection .78, respect .60, attachment .80, familiarity .82 |

- `conflict`/`fear` seed to `0` (no legacy signal for them).
- `romanticInterest` seeds to `0` unless the character policy or existing timeline events imply
  romance (conservative — romance should be *earned* post-migration, not fabricated).
- Familiarity is additionally floored by transcript length (a 300-message legacy chat is clearly
  familiar).
- The seeding is applied once; a `relationshipSchemaVersion` marks the chat as migrated so it's not
  re-seeded.

**Guarantee (M2):** the projected stage immediately after migration equals the legacy stage for
every band, so users see no personality change on upgrade.

## 3. Storage migration

- **Persist version bump** (Zustand `persist.version` N→N+1) with a `migrate(persisted, from)` that:
  1. for each chat, if `relationship` is the legacy shape, compute the seed vector (§2) and attach
     the new `relationship` (vector) + a `relationshipMeta` (edgeId, schemaVersion);
  2. create the `user`/`character` `Actor`s and the primary `user→character` edge for the chat scope;
  3. write an initial `RelationshipSnapshot` (source `system`, note "migrated from v0.1").
- **Adapter phasing:** Phase A stores the new slices inside the existing `localStorage` store
  (fastest path, no new infra). Phase C moves events/snapshots to the **IndexedDB**
  `RelationshipRepository` behind its interface — a swap invisible to `core/` (DATABASE_SCHEMA §5).
- **No destructive deletes:** legacy `affinity/stageIndex` may be retained (ignored) until Phase D
  cleanup, so a rollback within the window is trivial.

## 4. Export / import migration

- Bump `ChatExport` to `version: 2`, carrying `relationships { edges, events, snapshots }` alongside
  chats.
- **Import v1 → v2:** relationship data absent ⇒ seed via §2 on import (same path as load).
- **Import v2 → v2:** lossless round-trip (tested M3).
- Branches remain portable: edge/ledger/snapshots travel with their `scopeId`.

## 5. Phased rollout

**Phase A — Core + shim (no behavior change visible).**
Ship pure `relationship-vector/engine/events/projection` + the compatibility shim + the seeding
`migrate()`. Wire `applyAmbient`/`applyEvent` into the pipeline; keep prompt output equivalent via
the shim. Deliverable: existing chats keep behaving; new nine-dim state is live underneath. Tests:
U*, A*, P*, M1–M4.

**Phase B — Events & authoring.**
Add the deterministic `EventDetector`, user-pinned events (extend the timeline milestone UI), and
memory-derived events. Now relationships change through events; conversation is capped. Add the
relationship panel (view the nine dimensions + recent ledger). Tests: detector contract, I1–I5.

**Phase C — Projections into generation + IndexedDB.**
Switch prompt/greeting/narration/emotion to the richer projections (§7); replace `pickGreeting` with
`selectGreeting`; add the `relationshipBaselineBias` into the emotion baseline. Move persistence to
the IndexedDB `RelationshipRepository`. Tests: I6–I8, repository contract over both adapters.

**Phase D — Cleanup & NPC-ready.**
Remove legacy `affinity/stageIndex` reads; drop the shim if all consumers use projections directly;
confirm the schema supports (but does not yet run) reverse and NPC↔NPC edges. Update `CLAUDE.md`
sprint log + `TODO.md`.

## 6. Rollback

- Each phase is independently revertible; the persist `migrate()` is additive, so reverting code
  leaves data readable by v0.1 (legacy fields retained until Phase D).
- If a phase regresses character consistency (M2 fails in the field), revert that phase's wiring; the
  seed vector + ledger remain valid for a later retry.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Visible personality jump on upgrade | §2 seeding tuned to preserve stage; test **M2** gates release |
| Snapshot/ledger storage growth | IndexedDB adapter (Phase C) + snapshot cadence + future compaction hook |
| Over-eager auto-detection distorts relationships | detector low-weight + `confidence < 1`; pivotal changes require user-pinned/confirmed events |
| Migration run twice corrupts state | `migrate()` idempotent, guarded by `relationshipSchemaVersion` (test M4) |
| Consumers coupled to legacy shape | compatibility shim + phased switch; `core/` purity keeps the seam swappable |

## 8. Out of scope (this sprint / this plan)

Implementation, NPC↔NPC runtime behavior, LLM-based detection, ledger compaction, and any Phase 4
feature. This plan is the **route**; code lands in later sprints per the phases above.
