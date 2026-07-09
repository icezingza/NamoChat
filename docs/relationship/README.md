# Relationship Engine — Design Set (Sprint 2 / v0.2.0)

**Design-only.** No implementation exists yet; these documents are the production-quality
architecture that implementation must follow. Read in this order:

1. [ADR-0004 — Relationship Engine](../adr/ADR-0004-Relationship-Engine.md) — the decision & rationale.
2. [RELATIONSHIP_ENGINE_SPEC.md](RELATIONSHIP_ENGINE_SPEC.md) — dimensions, events, algorithms, projections, invariants.
3. [RELATIONSHIP_STATE_MACHINE.md](RELATIONSHIP_STATE_MACHINE.md) — stage ladder, overlays, attachment styles.
4. [RELATIONSHIP_DATABASE_SCHEMA.md](RELATIONSHIP_DATABASE_SCHEMA.md) — logical schema + local-first mappings.
5. [RELATIONSHIP_SEQUENCE_DIAGRAM.md](RELATIONSHIP_SEQUENCE_DIAGRAM.md) — how it sits in the turn pipeline.
6. [RELATIONSHIP_API.md](RELATIONSHIP_API.md) — public contracts (types + signatures).
7. [RELATIONSHIP_TEST_PLAN.md](RELATIONSHIP_TEST_PLAN.md) — what must be green before it ships.
8. [MIGRATION_PLAN_v0.2.md](MIGRATION_PLAN_v0.2.md) — non-breaking v0.1 → v0.2 route.

## In one paragraph

The relationship stops being a single `affinity` score and becomes a **nine-dimension vector**
(trust, affection, respect, attachment, dependence, familiarity, romanticInterest, conflict, fear),
each evolving **independently**. Change comes primarily from **weighted events** (user-pinned,
auto-detected, memory-derived); **conversation alone is capped**. Stage/attachment become **derived
projections** with hysteresis and overlays. State is a **directed edge between actors** (user↔
character now, NPC↔NPC ready), snapshotted per timeline and **forked on branching**. The vector
conditions **prompt, greeting, narration, and emotional baseline** through the existing persona seam,
and the pure core stays framework-free and unit-testable.
