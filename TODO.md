# NamoChat — TODO

Sequenced by project priority: **1 Character Consistency · 2 Memory · 3 Roleplay · 4 UI/UX · 5 Performance · 6 Clean Code.**
Never sacrifice character consistency; never break memory.

## Sprint 2 (v0.2.0) — Relationship Engine

**Design gate (this sprint): documentation only — NO implementation.**
- [x] ADR-0004 + 7 design docs under `docs/relationship/` (SPEC, STATE_MACHINE, DATABASE_SCHEMA,
  SEQUENCE_DIAGRAM, API, TEST_PLAN, MIGRATION_PLAN_v0.2) + index
- [x] **Phase A** — pure core (vector/events/ledger/core/projection) + compatibility shim +
  seeding migrate() + gated pipeline integration (memory events + prompt builder) behind
  `relationshipEngineV2` (default OFF). 73 tests; see `MIGRATION_REPORT_v0.2-relationship.md`.
- [ ] Phase B — text event detector + user-pinned events + relationship panel (UI)
- [ ] Phase C — projections into greeting/narration/emotion baseline + IndexedDB repository
- [ ] Phase D — promote flag to default, drop legacy scalar, NPC-edge readiness
- [ ] (deferred) Emotion Engine integration — `relationshipBaselineBias` exists but is NOT wired

## Scenario Pack System (v0.2.x) — DESIGN ONLY

Optional, opt-in extension packs (external lore data; **off by default**; no core/engine changes).
Design in `docs/scenario-packs/` (ARCHITECTURE, SCHEMA, MIGRATION_PLAN). Note: the uploaded
"Sex Positions & Kinks" SillyTavern lorebook contains a prompt-injection `debug` entry that the
design quarantines on import. Implementation deferred (Phases A–E in the migration plan).
- [x] Architecture + schema + migration/rollout docs
- [ ] Phase A — schema/validator/injection-scanner module (pure)
- [ ] Phase B–E — importer, registry/IndexedDB, flag-gated lore-seam wiring, UI

## Generic Lore Engine (v0.2.x) — DESIGN ONLY

Generalize the minimal `core/lore` into a four-scope (character/world/scenario/private),
model-independent Lore Engine integrated with the Relationship (v0.2) and Memory engines. Design in
`docs/lore/` (LORE_ENGINE_SPEC, LORE_ENTRY_SCHEMA, LORE_RETRIEVAL_PIPELINE, JANITOR_IMPORT_ADAPTER).
- [x] Spec + entry schema + retrieval pipeline + Janitor import-adapter design
- [ ] Implementation deferred (pure core first; backward compatible with existing `matchLore`)

## Phase 1 — Foundation ✅ (PR #16)

- [x] Repo analysis + migration doc + architecture doc
- [x] Core engines (character, identity, soul, emotion, relationship, memory, lore, timeline, prompt, cognition, providers)
- [x] Multi-model router (Claude/Gemini/OpenAI-compatible + mock), streaming, abortable
- [x] Zustand stores + guarded localStorage; turn pipeline
- [x] Dark mobile-first UI; gallery/profile/editor; multi-chat; search; export/import; edit/regenerate/continue
- [x] 26 unit tests; browser smoke test
- [x] Review fixes: memory-pollution guards, unicode search, deferred URL revoke

## Phase 2 — Depth (in progress)

### 2A · Character Consistency (priority 1)
- [x] Per-character **system-prompt override** (advanced field, replaces the default preamble when set)
- [x] **Alternate greetings** (first-message variants) — choose/shuffle when starting a chat
- [x] **Persona lock** — identity `consistencyRules` always injected, never budget-trimmed
- [x] Example-dialogue always in the system prompt (few-shot anchoring)

### 2B · Memory Quality (priority 2)
- [x] Wire **semantic embeddings** into the turn pipeline (best-effort `safeEmbed`, store vector on each memory, cosine recall with lexical fallback)
- [x] **Memory inspector/editor** — view, pin (weight↑), forget records per chat
- [x] **World memory** authoring (persistent facts shared across a character's chats)

### 2C · Roleplay Quality (priority 3)
- [x] **Lore editor** UI (keyword-triggered + always-active entries) on the character
- [x] **Story timeline** UI (chronological beats) + manual milestone pinning

### 2D · UI/UX (priority 4)
- [x] **Image messages** — attach an image URL/data-URI to a user turn
- [x] Character profile media polish; timeline/lore/memory surfaced in-app

## Phase 3 — Polish

- [x] Animation/transition pass (view transitions, message stagger)
- [x] **Virtualized** long chats (windowed render) for performance
- [x] **Chat branching** (fork a chat from any message)
- [x] **PWA**/offline packaging (manifest + service worker)
- [ ] Backup encryption (deferred — optional, low roleplay value)

## Continuous
- [x] Maintain TODO.md + namochat/CLAUDE.md
- [x] Commit per milestone; refactor over rebuild
