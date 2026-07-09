# Lore Engine — Entry & Book Schema (design only)

Design-only. Data shapes (as **specification**, not implementation) for the generic Lore Engine.
Superset of the current `LoreEntry` (backward compatible). Companion to `LORE_ENGINE_SPEC.md`.

## 1. Scope & book

```ts
type LoreScope = 'character' | 'world' | 'scenario' | 'private';

interface LoreBook {
  id: string;
  scope: LoreScope;
  name?: string;
  source?: 'native' | 'janitor' | 'sillytavern-worldinfo' | 'scenario-pack' | string;
  // book-level activation controls (Character-Book v2 lineage)
  scanDepth?: number;          // messages of history scanned (default 3)
  tokenBudget?: number;        // max tokens this book may contribute
  recursiveScanning?: boolean; // allow activated content to trigger more (bounded)
  trusted: boolean;            // false for imported books → injection-scanned, data-enveloped
  tags: string[];
  entries: LoreEntry[];
  createdAt: number;
  updatedAt: number;
}
```

## 2. Entry (generic superset)

Every field except `id`/`content` is **optional**; the current `{id,keys,content,alwaysActive}` is a
valid subset.

```ts
interface LoreEntry {
  id: string;
  content: string;                 // injected descriptive text (sanitized if imported)

  // ── triggers ──
  keys?: string[];                 // primary trigger keywords
  secondaryKeys?: string[];        // refine a primary match
  selectiveLogic?: 'andAny' | 'andAll' | 'notAny' | 'notAll';
  caseSensitive?: boolean;         // default false
  matchWholeWords?: boolean;       // default true
  alwaysActive?: boolean;          // constant / always-on (keys ignored)

  // ── activation gates ──
  probability?: number;            // 0..100 (default 100)
  minMessages?: number;            // don't fire before N turns
  cooldownTurns?: number;          // min turns between activations
  whenRelationship?: RelationshipCondition;   // §3
  whenMemory?: MemoryCondition;               // §4

  // ── ordering / placement ──
  priority?: number;               // higher wins under budget (default 0)
  order?: number;                  // insertion_order; lower = earlier
  position?: 'before_char' | 'after_char' | 'atDepth';
  atDepth?: number;                // when position = 'atDepth'
  tokenWeight?: number;            // relative budget weight

  // ── integration hooks (optional; applied by the APP layer, not the pure core) ──
  relationshipEffectOnReveal?: RelationshipEffectTemplate;  // §3.1
  promoteToMemoryOnReveal?: boolean;                        // §4.1

  // ── metadata / safety ──
  tags?: string[];
  comment?: string;                // author note — NEVER injected
  enabled?: boolean;               // default true
  blocked?: boolean;               // true ⇒ quarantined by injection scan (never injected)
  blockReason?: string;
  embedding?: number[];            // optional, for semantic activation (provider-computed)
}
```

## 3. Relationship condition (integrates v0.2 Relationship Engine)

A pure predicate over the current relationship vector/projection. Evaluated read-only.

```ts
interface RelationshipCondition {
  // raw dimension gates (any subset)
  trustMin?: number; trustMax?: number;
  affectionMin?: number; respectMin?: number;
  attachmentMin?: number; romanticInterestMin?: number;
  conflictMax?: number; fearMax?: number;
  // projection gates
  stageAtLeast?: 'Stranger'|'Acquaintance'|'Companion'|'Intimate'|'Devoted';
  overlay?: 'Rupture'|'Fearful'|'Obsessive'|'Estranged'|'Normal';
  romantic?: boolean;
}
```

Example: a childhood-trauma reveal → `whenRelationship: { trustMin: 0.65, stageAtLeast: 'Intimate' }`.

### 3.1 Relationship effect on reveal (optional write hook)

```ts
interface RelationshipEffectTemplate {
  type: string;                     // relationship event type (e.g. 'secret_shared')
  weight: 'minor'|'moderate'|'major'|'pivotal';
  deltas?: Record<string, number>;  // optional override
}
```

Emitted **once**, by the application layer, the first time the entry activates — reusing the
relationship runtime (like memory-derived events). The pure lore core never mutates relationship
state.

## 4. Memory condition (integrates Memory Engine)

```ts
interface MemoryCondition {
  recalledKeyword?: string[];   // passes if a recalled memory contains any of these
  minEmotionWeight?: number;    // require a recalled memory above this salience
  role?: 'user' | 'character' | 'world';
}
```

### 4.1 Promotion to memory

`promoteToMemoryOnReveal: true` ⇒ on first injection the application layer seeds a low-weight
`MemoryRecordProps` (role `world`) so the fact persists and can be recalled/relationship-weighted
later. Opt-in; pure core stays memory-read-only.

## 5. Down-projection to the existing engine

At retrieval, an **active, non-blocked** entry is reduced to the current core `LoreEntry`
(`{id,keys,content,alwaysActive}`) for the unchanged `matchLore`-style scan, while the richer fields
(gates, priority, position) are evaluated by the new pipeline **around** that call. Existing
character `lorebook` entries validate as-is.

## 6. Resolved entry (engine output)

```ts
interface ActiveLoreEntry {
  entry: LoreEntry;
  scope: LoreScope;
  matchedKeys: string[];         // [] for alwaysActive
  score: number;                 // relevance for ordering
  position: 'before_char'|'after_char'|'atDepth';
  source: LoreBook['source'];
  trusted: boolean;              // false ⇒ wrapped in data-only envelope
}
```

## 7. Validation rules

- **V1** `id`, `content` (non-empty after sanitization) required per entry; `scope` required per book.
- **V2** `keys` required unless `alwaysActive`.
- **V3** `probability ∈ [0,100]`; `priority`/`order` finite; `scanDepth ≥ 1`.
- **V4** Imported books: `trusted:false`; every `content` sanitized + injection-scanned; entries
  resembling system overrides → `blocked:true` (never injected). Executable/script fields are
  **dropped** on import, never stored or run.
- **V5** `whenRelationship`/`whenMemory` reference only defined dimensions/enums; unknown keys
  ignored (forward compatible).
- **V6** Size guards: max entries/book, max content length, to bound storage + token cost.

## 8. Storage

- **Character** lore: on the character card (`card.lorebook`), as today (backward compatible).
- **World/Private/Scenario** books: a dedicated repository (IndexedDB, guarded degrade-to-memory),
  keyed by `book.id`, scoped to global / chat / character as appropriate. Private + world books are
  namespaced per chat/character; scenario books come from the Scenario Pack registry.
- Embeddings (if used) stored on the entry; recomputed lazily and best-effort.
