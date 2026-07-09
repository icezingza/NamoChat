# NamoChat — Migration Document

**Status:** Phase 1 implemented
**Date:** 2026-07-09
**Scope:** Consolidate seven NaMo-ecosystem repositories into one clean, modular AI Roleplay
Chat Platform (**NamoChat**) for personal use. Repositories are treated as *knowledge sources
and reusable modules only* — no repository is merged wholesale.

---

## 1. Repository Analysis

### 1.1 `sovereign-platform-v3` (TypeScript / NestJS / DDD)

A disciplined DDD backend: `MemoryRecord` aggregate with a strict lifecycle state machine
(ACTIVE → ARCHIVED/FORGOTTEN/DELETED), snapshot/reconstitution pattern, outbox pattern,
repository contract tests.

| Verdict | Detail |
|---|---|
| **Reusable (patterns)** | Memory lifecycle state machine, snapshot-as-DTO boundary, repository port/adapter split, "no setters — behavior methods only" aggregate style. |
| **Not ported (code)** | NestJS composition root, Drizzle/SQLite adapters, outbox/event-bus, HTTP layer — NamoChat is a client-side app; a server persistence stack is out of scope for a personal-use chat client. |
| **Host repo** | NamoChat lives here (`namochat/`) as a self-contained Vite app, isolated from the existing `src/` backend. |

### 1.2 `NaMo_Forbidden_Archive` (Python / FastAPI)

The most feature-complete persona system: five persona engines, relationship engine
(stage progression + attachment styles), intent analyzer, cognitive stack (emotion momentum,
monologue, learning), RAG memory, TTS/media adapters.

| Verdict | Detail |
|---|---|
| **Reusable (ported to TS)** | `RelationshipEngine` — stage progression (Stranger → Plaything → Lover → Obsession) and attachment styles (Secure/Anxious/Possessive/Avoidant), generalized to configurable per-character stages driven by trust/affinity instead of "sin points". `IntentAnalyzer`'s keyword-signal approach informs the emotion signal extraction. |
| **Reusable (concepts)** | Per-session state isolation, `process_input` media-trigger envelope (informs future image/audio message support), graceful degradation when a provider is absent. |
| **Obsolete for NamoChat** | Python server, engine registry, rate limiter, admin routes, ElevenLabs/emotion HTTP adapters, all five concrete persona engines (persona content becomes *data* — character cards — not code). |

### 1.3 `darknamo-nexus-3-` (TypeScript / React / Vite) — **primary code donor**

Already a browser roleplay client with framework-free `core/` engines and Jest coverage.

| Module | Verdict |
|---|---|
| `core/emotion/EmotionEngine.ts` | **Ported** → `core/emotion/emotion-engine.ts`. Pure affect vector (valence/arousal/trust/passion/resonance) with inertia + decay. |
| `core/domain/MemoryRecord.ts` | **Ported** → `core/memory/memory-record.ts`. Lifecycle + Jaccard lexical search + cosine semantic search kept. |
| `core/identity/IdentityCapsule.ts` | **Ported** → `core/identity/identity-capsule.ts`, extended with the richer blueprint fields from `namo-identity-capsule`. |
| `core/Token_Budget.ts` | **Ported** → `core/prompt/token-budget.ts` (length/4 heuristic, output headroom). |
| `core/cognition/StreamParser.ts` | **Ported** (pattern) → `core/cognition/stream-parser.ts`. Incremental `<cognitive_stream>` stripper. |
| `core/providers/IModelProvider.ts`, `ModelRegistry.ts` | **Superseded** by `core/providers/` multi-model router — same port/registry idea, widened to 7 backends with message-array payloads and abortable streams. |
| `core/evolution/EvolutionEngine.ts` | **Ported (slimmed)** into `core/memory/memory-engine.ts` reward/penalty weighting. |
| `services/MemoryRepository.ts` | **Pattern reused** → guarded-localStorage persistence in `src/lib/storage.ts` + stores. |
| `TelemetryService`, `ABTestManager`, `DataExporter`, pitch-report scripts | **Obsolete** — A/B testing, pitch metrics and fine-tuning export serve a product experiment, not personal roleplay. |
| `Unified_Moral_Layer`, `Subliminal_Processor`, `Emotional_Engine` (draft), `Desire_Metric_System`, `Narrative_Architect` | **Obsolete** — unused drafts or superseded by the ported emotion engine; keyword tone-signal idea survives in `core/emotion/signal-extractor.ts`. |

### 1.4 `namonexus-fusion-engine` (Python)

Bayesian multi-**sensor** fusion (drift detection, hierarchical Bayes, sensor trust scoring).
**Verdict: obsolete for NamoChat** — it is a sensor-data library, unrelated to roleplay chat.
Nothing ported.

### 1.5 `namofusion-soul-core` (Python)

Aspirational module names (emotional-core, memory-continuity-system, karmic-navigator, …)
but the modules are FastAPI stubs (several not even syntactically valid Python).
**Verdict: obsolete as code.** The *naming/intent* of "Soul Core" — a single fusion point that
turns identity + emotion + relationship into one persona state — is realized as
`core/soul/soul-core.ts`.

### 1.6 `Innovation-Research-Development-AI-System` (Python)

Distributed research-agent infrastructure (Qdrant/Neo4j/Redis/Postgres, agent orchestration).
**Verdict: obsolete for NamoChat** — explicitly "NOT a chatbot project". Its
`InferenceRouter` provider-abstraction shape validated the multi-model router design; nothing
ported directly.

### 1.7 `namo-identity-capsule` (Python / YAML)

Identity-as-data: `core_identity.yaml`, `persona_core.yaml`, `emotional_signature.json`,
`consistency_matrix.yaml`, guardrails.

| Verdict | Detail |
|---|---|
| **Reusable (schema)** | The blueprint fields (purpose, cognitive framework, emotional signature, consistency rules) extend `IIdentityBlueprint` in `core/identity/identity-capsule.ts`. Identity is data attached to a character card, never a hardcoded prompt string. |
| **Obsolete** | Python loader/engine, Gemini test scripts, golden-ratio experiments. |

---

## 2. Reusable Module Map (source → NamoChat)

| NamoChat module | Sourced from | Form |
|---|---|---|
| **Character Engine** (`core/character/`) | Forbidden Archive personas (as data), identity-capsule schema | New code, imported schema ideas; character-card JSON import (native + SillyTavern v2) |
| **Soul Core** (`core/soul/`) | namofusion-soul-core (name/intent), darknamo affect wiring | New code |
| **Identity Capsule** (`core/identity/`) | darknamo `IdentityCapsule` + namo-identity-capsule YAML schema | Direct port, extended |
| **Memory Engine** (`core/memory/`) | darknamo `MemoryRecord` + `EvolutionEngine`, sovereign-platform lifecycle discipline | Direct port + slim merge |
| **Prompt Builder** (`core/prompt/prompt-builder.ts`) | darknamo `getSystemContext` layering | New code, ported pattern |
| **Context Builder** (`core/prompt/context-builder.ts`) | darknamo 4-layer per-turn pipeline + `TokenBudget` gate | Port + rewrite |
| **Relationship Engine** (`core/relationship/`) | Forbidden Archive `relationship_engine.py` | Ported Python → TS, generalized |
| **Emotion Engine** (`core/emotion/`) | darknamo `EmotionEngine` + `Unified_Moral_Layer` signal idea | Direct port + new signal extractor |
| **Lore Engine** (`core/lore/`) | Forbidden Archive RAG-lite / world knowledge concept | New code (keyword-triggered entries) |
| **Story Timeline** (`core/timeline/`) | — (new requirement) | New code |
| **Multi-Model Router** (`core/providers/`) | darknamo `IModelProvider`/`ModelRegistry`, IRD `InferenceRouter` shape | New code, ported port/registry pattern |
| **Stream Parser** (`core/cognition/`) | darknamo `StreamParser` | Ported pattern |

## 3. Obsolete Modules (deliberately not carried forward)

- Payments / tokens / coins / subscriptions / marketplace / ads / social feed — none existed
  in any repo; **none introduced**.
- Multi-user auth, API-key plans, admin routes, rate limiting (Forbidden Archive, IRD) —
  NamoChat is single-user, local-first.
- Telemetry/pitch reporting, A/B cohorts, JSONL fine-tuning export (darknamo).
- Outbox/event-bus/NestJS/Drizzle server stack (sovereign-platform-v3).
- Bayesian sensor fusion (namonexus-fusion-engine), research-agent orchestration (IRD).
- All Python persona *engines* — persona is data (character cards), not code.
- TTS/voice, telegram/tools scripts — out of Phase-1..3 scope.

## 4. Duplication Removed

Seven repos contained **four** emotion engines, **three** memory systems, **three** identity
systems and **two** provider abstractions. NamoChat keeps exactly one of each:

- **Emotion:** darknamo's pure affect vector wins (tested, framework-free); Forbidden
  Archive's momentum/decay constants and keyword-signal approach folded in; soul-core stub
  and `Emotional_Engine.ts` draft dropped.
- **Memory:** darknamo `MemoryRecord` wins (already browser-shaped); sovereign-platform's
  stricter lifecycle discipline retained as design rules; RAG/FAISS dropped (no server).
- **Identity:** darknamo `IdentityCapsule` wins; identity-capsule YAML fields merged into
  the blueprint; monolithic prompt strings banned everywhere.
- **Providers:** one `ModelProvider` port + one router; per-engine LLM init code dropped.

## 5. Phase Plan

| Phase | Scope | Status |
|---|---|---|
| **1 — Foundation** | Vite/React/TS/Tailwind scaffold; all `core/` engines ported & unit-tested; multi-model router (Claude, Gemini, OpenAI-compatible: GPT/DeepSeek/Ollama/LM Studio/OpenRouter); Zustand stores with guarded localStorage persistence; dark mobile-first UI; character cards + import; multiple chats; streaming markdown messages; regenerate / continue / edit; chat search; export/import; emotion + relationship tracking wired per chat. | ✅ this change |
| **2 — Depth** | Semantic memory (provider embeddings + cosine search), richer lore editor, story-timeline UI, character profile media (image messages from card gallery), first-message variants, prompt-template overrides per character. | planned |
| **3 — Polish** | Animations/transition pass, virtualized long chats, PWA/offline packaging, chat branching, backup encryption. | planned |
