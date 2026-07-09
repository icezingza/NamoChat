# NamoChat — Extraction & Migration Report

**Date:** 2026-07-09
**Foundation source:** `icezingza/sovereign-platform-v3` @ merge commit `53a9b10` (PR #16, tagged `foundation`)
**This repository:** the canonical, independent **NamoChat** product. The seven NaMo-ecosystem
repositories are now **read-only migration references** — no further features land in them.

This report records what was carried into the canonical repo, what was rewritten on the way,
what was left behind, the technical debt eliminated, and the resulting architecture.

---

## 1. How the extraction was done

NamoChat was first incubated as a self-contained app inside `sovereign-platform-v3/namochat/`
(Phases 1–3, PR #16 — merged and tagged `foundation`). Because it was built decoupled from day
one — its own `package.json`, `tsconfig`, and a `core/` layer with **zero imports outside its own
tree** — extraction was a *lift*, not a *disentangle*:

- The `namochat/` subtree became the repository **root**.
- Build artifacts and vendored deps (`node_modules/`, `dist/`, `*.tsbuildinfo`) were dropped;
  `package-lock.json` retained for reproducible installs.
- Verified independent: fresh `npm install` → **32/32 tests pass**, clean `tsc -b`, clean
  production build — with no access to the host repository.

No source file needed editing to remove coupling, because there was none: a repo-wide scan for
imports escaping the app tree, host-repo package dependencies, and cross-project relative paths
returned nothing. The only mentions of `sovereign-platform-v3` are **provenance comments and
migration docs**, which correctly belong in a migration source.

---

## 2. Imported modules (carried in, behavior-preserved)

Reusable, production-ready modules pulled from the source repositories. "TS port" = translated
from Python with behavior preserved; "direct" = TypeScript kept as-is with local renames/typing.

| NamoChat module | Origin | Form | Tests |
|---|---|---|---|
| `core/emotion/emotion-engine.ts` | darknamo-nexus-3 `core/emotion/EmotionEngine.ts` | direct | ✅ |
| `core/memory/memory-record.ts` | darknamo-nexus-3 `core/domain/MemoryRecord.ts` + sovereign-platform lifecycle discipline | direct + merge | ✅ |
| `core/identity/identity-capsule.ts` | darknamo-nexus-3 `IdentityCapsule` + namo-identity-capsule YAML schema | direct + extend | ✅ (via prompt) |
| `core/relationship/relationship-engine.ts` | NaMo_Forbidden_Archive `relationship_engine.py` | **TS port** + generalized | ✅ |
| `core/prompt/token-budget.ts` | darknamo-nexus-3 `core/Token_Budget.ts` | direct | ✅ |
| `core/cognition/stream-parser.ts` | darknamo-nexus-3 `core/cognition/StreamParser.ts` | direct (pattern) | ✅ |
| `core/providers/*` (port + registry) | darknamo-nexus-3 `IModelProvider`/`ModelRegistry`; IRD `InferenceRouter` shape | pattern reuse | — |

## 3. Rewritten modules (concept kept, implementation new)

| NamoChat module | Rewritten from | Why rewritten |
|---|---|---|
| `core/memory/memory-engine.ts` | darknamo `MemoryRepository` + `EvolutionEngine` (two modules) | Merged the search/persistence adapter and the reward/penalty weighting into one browser-shaped engine; dropped `localStorage` coupling (persistence is the store's job). ✅ tested |
| `core/soul/soul-core.ts` | namofusion-soul-core (FastAPI stubs) | Source was non-functional stubs; realized the "single fusion point" intent as a pure function of identity + affect + relationship. |
| `core/prompt/{prompt-builder,context-builder}.ts` | darknamo `getSystemContext`/4-layer `App.tsx` pipeline | Split into a once-per-chat system builder and a per-turn, budget-gated context builder; added the never-trimmed **persona lock**. ✅ tested |
| `core/providers/{claude,gemini,openai-compatible}.ts` | darknamo `GeminiProvider` (single backend) | Widened one Gemini-only provider to 7 backends behind a common streaming/abortable port. |
| `core/character/character.ts` | Forbidden Archive persona *engines* (Python classes) | Persona became **data** (card schema + import), not code — collapsing five hardcoded engines into one card format. ✅ tested |
| `core/lore/lore-engine.ts` | Forbidden Archive server RAG (`rag_memory_system.py`, FAISS) | Re-expressed as client-side keyword-triggered entries — no server, no FAISS. ✅ (via context) |

## 4. Removed modules (deliberately not extracted)

| Removed | From | Reason |
|---|---|---|
| NestJS composition root, Drizzle/SQLite adapters, outbox/event-bus, HTTP controllers | sovereign-platform-v3 | Server persistence stack — NamoChat is a local-first client. |
| Telemetry, A/B `ABTestManager`, `DataExporter`, pitch-report scripts | darknamo-nexus-3 | Product-experiment tooling, not roleplay. |
| `Unified_Moral_Layer`, `Subliminal_Processor`, `Emotional_Engine` draft, `Desire_Metric_System`, `Narrative_Architect` | darknamo-nexus-3 | Unused drafts / superseded by the ported emotion engine (signal idea survives in `signal-extractor.ts`). |
| All five Python persona engines, engine registry, rate limiter, admin routes, ElevenLabs/emotion HTTP adapters | NaMo_Forbidden_Archive | Persona is now data; server/IO out of scope. |
| Bayesian sensor fusion (drift, hierarchical Bayes, sensor-trust) | namonexus-fusion-engine | Sensor-data library, unrelated to roleplay. |
| Research-agent orchestration (Qdrant/Neo4j/Redis/Postgres, agents) | Innovation-Research-Development-AI-System | Explicitly "NOT a chatbot project." |
| Python loader/engine, Gemini test scripts, golden-ratio experiments | namo-identity-capsule | Only the identity *schema* was reusable. |
| Payments / tokens / coins / subscriptions / marketplace / ads / social feed / multi-user auth | (requested exclusions) | None existed in any source repo; **none introduced.** |

## 5. Technical debt eliminated

- **Duplication collapsed:** 4 emotion engines → **1**; 3 memory systems → **1**; 3 identity
  systems → **1**; 2 provider abstractions → **1**; 5 persona engines → **1 card format**.
- **Dead/broken code dropped:** namofusion-soul-core FastAPI stubs (some not valid Python),
  unimported darknamo drafts, orphaned `system_core/`/`scenarios/` bypass modules — none carried.
- **Language/runtime fragmentation removed:** four Python services + one TS app → a **single
  TypeScript codebase** with one build, one test runner, one dependency graph.
- **Server/infra coupling removed:** no FAISS, Qdrant, Neo4j, Postgres, Redis, SQLite, NestJS,
  or FastAPI — the product runs entirely in the browser.
- **Prompt debt removed:** monolithic hardcoded persona prompt strings replaced by
  data-driven `CharacterCard` + `IdentityBlueprint`; a single builder is the only code that
  emits prompt text.
- **Safety-integrity debt addressed:** error text and internal directives can no longer pollute
  long-term memory; the persona lock is immune to token-budget trimming.

## 6. New architecture (canonical)

Clean Architecture, feature-based, framework-free core:

```
core/     pure domain + application logic — NO React/DOM/storage/LLM-SDK imports, unit-tested
  character · identity · soul · emotion · relationship · memory · lore · timeline ·
  prompt (builder/context/token-budget) · cognition · providers (port + 7 backends + mock)
   ↑
stores/   Zustand application layer — owns persistence via guarded localStorage; the turn pipeline
   ↑
features/ React UI, one folder per feature (chat · characters · settings)
components/ui · lib
```

Turn pipeline:
`user text → emotion signals → EmotionEngine → RelationshipEngine → SoulCore → memory (semantic
w/ lexical fallback) + lore → ContextBuilder (budget-gated) → provider stream → StreamParser →
persist memory + timeline`.

**Preserved from the Foundation:** the layer boundaries, the 32-test core suite, and all four
docs (`MIGRATION.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `TODO.md`).

---

## 7. Status

- ✅ Extracted, decoupled, and verified independent (32/32 tests, clean build).
- ✅ Tagged `foundation` / `v0.1.0` at the initial commit of this repository.
- ⏸ **Phase 4 not started** — extraction is the stopping point, per instruction.
