# ADR-0004 — Multi-Dimensional Relationship Engine

- **Status:** Accepted (design) — Sprint 2 / v0.2.0. Design-only; no implementation in this ADR.
- **Date:** 2026-07-09
- **Deciders:** Lead Architect
- **Supersedes:** the v0.1.0 scalar relationship model (`RelationshipState { affinity, stageIndex }`).
- **Related:** `RELATIONSHIP_ENGINE_SPEC.md`, `RELATIONSHIP_STATE_MACHINE.md`,
  `RELATIONSHIP_DATABASE_SCHEMA.md`, `RELATIONSHIP_SEQUENCE_DIAGRAM.md`,
  `RELATIONSHIP_API.md`, `RELATIONSHIP_TEST_PLAN.md`, `MIGRATION_PLAN_v0.2.md`.

> ADRs 0001–0003 predate this decision log and describe the v0.1 Foundation
> (clean architecture, local-first persistence, provider port). This is the
> first ADR recorded under `docs/adr/`.

## Context

The v0.1.0 Relationship Engine (`src/core/relationship/relationship-engine.ts`) models a
relationship as a **single scalar** `affinity ∈ [0,1]` plus a derived `stageIndex`. Every turn,
`progress(state, affect)` nudges affinity by up to `AFFINITY_STEP` (0.04) from a blend of the
turn's `trust`/`passion` affect. That has three structural problems for a premium roleplay product
where **character consistency and relationship believability are priorities #1–#3**:

1. **One number cannot express a real relationship.** "Trusts you but fears you," "adores you but
   doesn't respect you," "attached but resentful" — none are representable. Nuance is the product.
2. **Conversation alone inflates the bond.** Affinity rises on essentially every non-negative turn,
   so a long idle chat drifts to "Devoted" without anything meaningful having happened.
3. **No event memory.** The model has no notion of *what* changed the relationship, so it cannot
   explain itself, cannot be audited on a timeline, and cannot be replayed on a branch.

Simultaneously, v0.1 already gives us the scaffolding we must respect and reuse: the affect vector
(`EmotionEngine`), the memory lifecycle (`MemoryEngine`), the story timeline (`TimelineEvent`),
per-chat state snapshots on `forkChat`, and the persona-fusion point (`derivePersonaState` →
`PersonaState` → `ContextBuilder`). The relationship is *already* consumed by prompt generation; we
are upgrading the model behind that seam, not inventing a new seam.

## Decision

Replace the scalar with a **nine-dimension relationship vector**, each dimension evolving
**independently** and changing **primarily through weighted events**, not raw conversation.

**Dimensions:** `trust`, `affection`, `respect`, `attachment`, `dependence`, `familiarity`,
`romanticInterest`, `conflict`, `fear` — each `∈ [0,1]` with defined baselines and decay/stickiness
profiles (see SPEC §3).

Key architectural choices:

1. **Events are the unit of change.** A `RelationshipEvent` carries a typed delta vector and a
   **weight** (`minor|moderate|major|pivotal`). Conversation produces only a small, **capped
   "ambient" update** (familiarity growth, conflict/fear decay, a tiny tone nudge). Meaningful
   change requires a meaningful event — user-pinned milestones, auto-detected salient moments
   (confession, betrayal, gift, threat, apology…), or memory-derived events from high-emotion-weight
   memories.
2. **Stage is a projection, not the source of truth.** The familiar Stranger→Devoted ladder and the
   attachment style become **derived read-models** computed from the vector, with hysteresis and
   special overlays (Rupture, Fearful, Obsessive, romantic variants). Existing consumers keep a
   stage/directive interface (§Migration), so `soul-core`/`context-builder` need no rewrite.
3. **Relationship is a directed edge between actors.** State is keyed by `(sourceActorId →
   targetActorId)`, defaulting to `user → character`. This makes the reverse edge (character→user)
   and future **NPC↔NPC** relationships a data concern, not a schema migration.
4. **Snapshots per timeline node, branch-safe.** A `RelationshipSnapshot` is captured with the
   vector + recent event ledger. Branching a chat forks the snapshot (extending today's `forkChat`
   behavior); pinned events anchor replayable points on the timeline.
5. **Purity preserved.** The engine stays framework-free and unit-testable in isolation (no
   storage/DOM/LLM). Persistence and detection live in the application/adapter layers, consistent
   with `CLAUDE.md` layer boundaries.

The relationship vector influences, through the existing persona-fusion seam: **prompt** generation,
**greeting** selection, **narration** tone, and **emotional-response** baselines (SPEC §7).

## Alternatives considered

- **Keep the scalar, add hidden sub-scores.** Rejected: still conflates independent feelings and
  keeps the conversation-inflation bug.
- **Two axes (valence × arousal), reuse affect.** Rejected: affect is *momentary mood*;
  relationship is *durable, dimensioned history*. Collapsing them loses "warm mood in a
  low-trust relationship," which is exactly the tension roleplay needs.
- **LLM-scored relationship each turn.** Rejected: non-deterministic, untestable, token-costly, and
  violates the pure-core rule. Detection *may* optionally use signals, but the state math is pure.
- **Server-side relational DB.** Rejected: NamoChat is local-first (no server, no auth). We define a
  **logical** schema mapped onto local persistence (IndexedDB) with an optional SQLite mapping for a
  future desktop build (see DATABASE_SCHEMA).

## Consequences

**Positive**
- Believable, explainable relationships; auditable on the timeline; replayable on branches.
- Conversation no longer inflates the bond; pivotal moments feel pivotal.
- Richer prompt/greeting/narration conditioning → priorities #1–#3 improved.
- Forward-compatible with NPC autonomy and multi-character scenes.

**Negative / costs**
- More state to persist; snapshots increase storage → motivates an IndexedDB adapter (v0.2).
- Event **detection quality** becomes a first-class concern (test plan covers it; ambiguous
  detections are low-weight and reversible).
- A migration is required for existing persisted chats (MIGRATION_PLAN_v0.2 — non-destructive,
  versioned, with a legacy `affinity → vector` seeding map).

**Neutral**
- Stage ladder remains as a read-model; existing UI/prompt copy keeps working during migration.

## Non-goals (this sprint)

- No implementation, no wiring changes, no schema code. Design artifacts only.
- No Phase 4 features. No NPC↔NPC *runtime* (schema is prepared; behavior is future work).
