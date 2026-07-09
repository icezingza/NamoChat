# Lore Engine — Retrieval Pipeline (design only)

Design-only. The per-turn flow from raw books to injected, budget-gated lore, and where it sits in
NamoChat's existing turn pipeline (`stores/chat-pipeline.ts`) alongside memory recall and the
relationship projection. Pure core; the application layer orchestrates I/O. Companion to
`LORE_ENGINE_SPEC.md`.

## 1. Stages

```
① Gather        collect entries from all active scopes (character/world/scenario/private)
② Scan text     build the bounded window: lastN messages ⊕ user msg ⊕ recalled-memory text
③ Activate      per entry, evaluate ALL gates → active? (keyword+selective, probability,
                 min-messages/cooldown, whenRelationship, whenMemory)
④ Recurse       (optional, bounded) feed activated content back into scan for one more pass
⑤ Dedupe        drop entries overlapping recalled memories or each other
⑥ Rank          scope precedence → priority → order → relevance
⑦ Budget        fit into the shared optional-context budget (persona lock never trimmed)
⑧ Position+wrap group by position; wrap untrusted lore in a data-only envelope
                 ⇒ ActiveLoreEntry[] for the context builder
```

All of ①–⑥ are **pure** functions of `(books, scanText, relationshipVector, stage, recalledMemories,
config, rng)`. ⑦–⑧ are pure given the budget. Only *gathering* books (storage) and *optional*
embedding (provider port) are impure and happen in the application layer.

## 2. Where it plugs into the existing turn pipeline

```mermaid
sequenceDiagram
  autonumber
  participant PIPE as chat-pipeline (app)
  participant SIG as signal-extractor
  participant REL as RelationshipEngine (v0.2, pure)
  participant MEM as MemoryEngine (recall)
  participant LORE as LoreEngine (pure)
  participant PROV as ModelProvider (port, optional embed)
  participant CTX as ContextBuilder
  participant APP as app (effects)

  PIPE->>SIG: extractSignals(text)
  PIPE->>REL: applyAmbient + project (vector, stage)   %% relationship known first
  PIPE->>MEM: recall(query)  → recalledMemories
  Note over PIPE,LORE: LoreEngine consumes relationship + memory as INPUTS
  PIPE->>LORE: retrieve({books, scanText(lastN ⊕ msg ⊕ memText), vector, stage, recalledMemories, rng})
  opt semantic activation (optional)
    LORE->>PROV: generateEmbedding(scanText)  %% any provider; falls back to lexical
  end
  LORE-->>PIPE: ActiveLoreEntry[] (ranked, positioned, deduped)
  PIPE->>CTX: buildTurnContext(personaLock, personaDirectives, memories, LORE, recap) [budget-gated]
  Note over CTX: persona lock/system prompt NEVER trimmed; lore+memory share optional tier
  PIPE->>PROV: streamChat(system, context, history)
  Note over APP: after the turn — apply optional hooks
  APP->>REL: emit relationshipEffectOnReveal (first activation only, via runtime)
  APP->>MEM: promoteToMemoryOnReveal → seed low-weight world memory
```

Ordering rationale:
- **Relationship + memory are computed first** so lore can be **gated by** relationship state and
  **triggered by** recalled memory (the integration requirements).
- Lore is assembled into the **same optional context tier** as memory, **below** the persona lock.
- **Effects run after the turn** in the application layer (never in the pure lore core), so a failed
  request never mutates relationship/memory (consistent with the existing pipeline discipline).

## 3. Shared optional-context budget (lore ↔ memory)

- Persona lock + system prompt + history are **mandatory** (never trimmed).
- Memory recall and lore compete for the **remaining** optional budget. The pipeline allocates by a
  configured split (e.g. memory : lore) and each side's own cap (`memory topK`, book `tokenBudget`),
  then fills by rank until the budget is spent.
- **Dedupe (⑤)** runs across the *combined* set so the same fact isn't paid for twice.
- Under pressure, optional context (memory + lore) is trimmed lowest-rank-first; persona survives.

## 4. Activation detail (stage ③)

For each entry, in order, short-circuiting on first failure:
1. `enabled && !blocked` else skip.
2. `alwaysActive` ⇒ keyword step skipped; else primary `keys` must match scan text (respecting
   `caseSensitive`/`matchWholeWords`), then `secondaryKeys` per `selectiveLogic`.
3. `minMessages`/`cooldownTurns` satisfied.
4. `whenRelationship` predicate passes against `(vector, stage)`.
5. `whenMemory` predicate passes against `recalledMemories`.
6. `probability` roll (injected `rng` for deterministic tests).
An entry passing all of the above is **active**; its `matchedKeys`/`score` are recorded.

## 5. Recursion safety (stage ④)

- Off unless the book sets `recursiveScanning`. When on, activated `content` is appended to the scan
  text for **one** additional activation pass (`maxRecursionDepth`, default 1).
- Hard **activation cap** per turn bounds total entries regardless of recursion, preventing loops and
  runaway token growth (L4).

## 6. Determinism, purity & model independence

- Given identical inputs and `rng`, the pipeline yields identical `ActiveLoreEntry[]` (unit-testable).
- No provider is required: lexical activation works fully offline. Semantic activation is an
  **optional** enhancement via the abstract `generateEmbedding` port and always falls back to lexical
  on absence/failure (best-effort) — the engine stays **model-independent**.
- The pure core imports nothing from `stores/`, `services/`, React, or any SDK.

## 7. Failure & edge handling

- No books / no matches ⇒ empty result; pipeline behaves exactly as today (backward compatible).
- Embedding failure ⇒ lexical fallback (no throw).
- Storage failure (gathering world/private/scenario books) ⇒ guarded degrade-to-memory; the turn
  still proceeds with whatever books loaded.
- Untrusted lore that fails the injection scan is `blocked` upstream (import) and never reaches ①.
