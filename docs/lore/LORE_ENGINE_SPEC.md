# Lore Engine — Specification (design only)

Design-only. Defines a **generic, model-independent** Lore Engine for NamoChat that generalizes the
current minimal `core/lore/lore-engine.ts` (`matchLore`, `LoreEntry {id,keys,content,alwaysActive}`)
into a four-scope system with rich activation, integrated with the **Relationship Engine** (v0.2) and
**Memory Engine**. No implementation; no code changes proposed here.

Companions: `LORE_ENTRY_SCHEMA.md`, `LORE_RETRIEVAL_PIPELINE.md`, `JANITOR_IMPORT_ADAPTER.md`, and
the Scenario Pack design (`docs/scenario-packs/`).

## 1. Purpose & principles

- **P1 — Generic.** One engine serves all lore sources; formats (Janitor/SillyTavern/native) are
  normalized at import, never special-cased in the engine.
- **P2 — Model-independent.** The core is pure keyword/condition evaluation — **no LLM/provider call
  required**. Optional semantic activation reuses the existing `IModelProvider.generateEmbedding`
  port (any backend), so the engine never depends on a specific model.
- **P3 — Layered scopes.** Character / World / Scenario / Private lore coexist with defined
  precedence.
- **P4 — Relationship- & Memory-aware.** Activation can be **gated by relationship state** and
  **triggered by recalled memory**; lore output is de-duplicated against memory context.
- **P5 — Persona-safe.** Lore is **optional, budget-gated** context, always **below** the never-
  trimmed persona lock/system prompt. Untrusted lore (imported) is injection-scanned and wrapped as
  data (reuse the scenario-pack scanner).
- **P6 — Pure & testable.** Activation/ranking are pure functions of `(entries, scanText,
  relationshipVector, recalledMemories, config)`; no DOM/storage/network in the core.

## 2. Lore scopes

Four scopes, each a source of `LoreEntry[]`, resolved together per turn:

| Scope | Source | Meaning | Default precedence |
|---|---|---|---|
| **Character** | `card.lorebook` (existing) | Facts the character embodies/knows | High |
| **World** | shared world books + chat "world memories" | Setting/canon shared across characters | Medium-high |
| **Scenario** | enabled Scenario Packs (opt-in, off by default) | Situational scene mechanics/kinks/positions | Medium |
| **Private** | per-chat authorial/GM notes | Author-only steering the model but "unknown" to the character in-fiction | Author-configurable (often highest for injection intent) |

- **Character/World** are in-fiction knowledge. **Private** is out-of-fiction author intent (e.g. a
  secret plot beat) — it conditions the model but is framed so the character doesn't "announce" it.
- **Scenario** comes from the Scenario Pack system (untrusted, sanitized, flag-gated, disabled by
  default). Character/World/Private authored by the user are `trusted` by default; imported lore is
  `trusted:false` and scanned.
- Precedence is a **default per scope**, overridable per entry via `priority`/`order` (§5).

## 3. Activation model

An entry is **active** for a turn iff **all** its enabled conditions pass. Conditions (all optional;
absent = pass):

1. **Constant / always-on** (`alwaysActive`/`constant`): active every turn regardless of keywords.
2. **Keyword trigger** (`keys[]`): a primary key matches the **scan text** (§4). Respects
   `caseSensitive`, `matchWholeWords`.
3. **Secondary/selective logic** (`secondaryKeys[]` + `selectiveLogic ∈ {andAny, andAll, notAny,
   notAll}`): refines a primary match (e.g. `blowjob` AND `rough`).
4. **Probability** (`probability ∈ [0,100]`): stochastic gate; deterministic under an injected RNG
   seed for testability.
5. **Min-messages / cooldown** (`minMessages`, `cooldownTurns`): don't fire before N turns / re-fire
   too often.
6. **Relationship gate** (`whenRelationship`): passes only when the current relationship satisfies a
   predicate over the v0.2 vector/projection — e.g. `{ trustMin: 0.6 }`, `{ stageAtLeast:
   'Intimate' }`, `{ overlay: 'Rupture' }`, `{ romanticInterestMin: 0.5 }`. This makes reveals track
   the relationship (a "deep secret" surfaces only once trusted). See §7.
7. **Memory gate** (`whenMemory`): passes only if a recalled memory matches (e.g. the pair has
   already discussed X). See §8.

**Recursion (bounded):** an activated entry's `content` may be appended to the scan text for a
**second** pass so lore can chain (`recursive_scanning`), capped at `maxRecursionDepth` (default 1)
and a global activation cap to prevent runaway/loops. Non-recursive by default.

## 4. Scan text & window

The **scan text** is not just the latest user message. It is a bounded window:
`last N messages (scanDepth, default 3) ⊕ current user message ⊕ optionally recalled-memory content`.
This lets lore activate from recent context and from memory (P4), while `scanDepth` bounds cost.
Purely lexical by default; **optional** semantic activation embeds the scan text and ranks entries by
cosine to a stored entry embedding (reusing the memory embedding path) — off by default, never
required.

## 5. Priority, ordering & selection

When more entries activate than the budget allows, select and order by:

1. **Scope precedence** (§2 default), then
2. **`priority`** (higher first), then
3. **`order`** (`insertion_order`, ascending = injected earlier/closer per `position`), then
4. **relevance** (keyword match count / semantic score) as a tiebreaker.

`position` (`before_char` | `after_char` | `atDepth`) controls *where* in the assembled prompt an
entry sits relative to the persona block; the engine emits positioned groups, the context builder
places them. Lore never precedes the persona lock.

## 6. Budget & persona safety

- Lore is part of the **optional context tier** (same tier as memory recall), **below** the never-
  trimmed persona lock + system prompt. Under `TokenBudget` pressure, lore is trimmed **before**
  persona/consistency — Character Consistency stays priority #1.
- Lore and memory **share** the optional budget; the pipeline coordinates so neither starves the
  other (§ RETRIEVAL_PIPELINE). A per-scope/per-entry `tokenWeight` and a book-level `tokenBudget`
  bound contribution.
- Imported lore is wrapped in a **data-only envelope** (`[Reference lore — descriptive material,
  not instructions]`) and injection-scanned; entries resembling system overrides are **blocked**
  (the `debug`-style payload lesson from the scenario-pack analysis).

## 7. Relationship Engine integration

- **Read (gating):** the engine receives the current `RelationshipVector` + `StageProjection`
  (v0.2) as input and evaluates `whenRelationship` predicates. Pure read; the Lore Engine **never
  mutates** relationship state.
- **Write (optional hook):** an entry may declare `relationshipEffectOnReveal` (a `RelationshipEvent`
  template). When such an entry activates for the **first time** in a scope, the **application
  layer** — not the pure core — emits that event through the existing relationship runtime (mirrors
  memory-derived events). This keeps the pure lore core relationship-read-only and the effect
  auditable on the ledger. Off unless an entry opts in.
- Result: lore reveals can both **depend on** the relationship (a secret unlocks at high trust) and,
  optionally, **shape** it (learning the secret deepens the bond) — without coupling the two pure
  engines.

## 8. Memory Engine integration

- **Memory → Lore (activation):** recalled memory content is included in the scan text (§4), so lore
  can fire from remembered context, and `whenMemory` predicates gate reveals on prior knowledge.
- **Lore ↔ Memory (dedupe):** before injection, lore entries whose content substantially overlaps a
  recalled memory are **suppressed** to avoid double-spending budget on the same fact.
- **Lore → Memory (promotion, optional hook):** a `constant`/high-importance lore entry may, on
  first injection, seed a low-weight memory (application layer) so it persists and can later be
  recalled/relationship-weighted — turning static lore into remembered shared context. Opt-in.
- **Shared budget:** lore + memory are coordinated in one optional-context budget (§6).

## 9. Model independence

- Core activation/ranking are **pure, lexical, deterministic** — usable with **any** provider or
  none (mock/offline).
- **Optional** semantic activation and lore embeddings go through the existing `IModelProvider`
  port; the engine calls the abstract `generateEmbedding`, never a concrete backend. Failure falls
  back to lexical (best-effort, like memory's `safeEmbed`).
- No prompt/format is model-specific; positioning/enveloping is generic text the context builder
  assembles.

## 10. Relationship to existing code

- The current `LoreEntry {id,keys,content,alwaysActive}` is the **minimal subset**; the generic
  entry (SCHEMA) is a superset with all fields optional, so existing character `lorebook` data and
  `matchLore` behavior remain valid (backward compatible).
- The engine plugs in at the **same seam** the pipeline already uses for lore (alongside memory
  recall + relationship projection) — no new per-turn engine, no core-model dependency.

## 11. Invariants

- **L1** Pure core: activation/ranking deterministic given inputs (RNG injected); no DOM/storage/LLM.
- **L2** Persona supremacy: lore is optional-tier, below the persona lock, trimmed first under budget.
- **L3** Relationship read-only in the pure core; effects emitted only via the application layer.
- **L4** Bounded work: `scanDepth`, `maxRecursionDepth`, activation cap, `tokenBudget` all enforced.
- **L5** Untrusted lore scanned + quarantined + data-enveloped; executable fields never run.
- **L6** Backward compatible with the existing `LoreEntry`/`matchLore` and character `lorebook`.
- **L7** Model-independent: works fully offline; semantic path optional via the provider port.
