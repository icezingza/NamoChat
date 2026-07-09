# Janitor Lorebook — Import Adapter (design only)

Design-only. **Analyzes** the Janitor lorebook JSON format and specifies an adapter that normalizes
it into the generic `LoreBook`/`LoreEntry` model (`LORE_ENTRY_SCHEMA.md`). **No content is imported**
here — this is a format/mapping design. Companion to `LORE_ENGINE_SPEC.md` and
`LORE_RETRIEVAL_PIPELINE.md`.

## 1. Format analysis

JanitorAI lorebooks descend from the **Character Card V2 `character_book`** / **SillyTavern World
Info** lineage. Two shapes appear in the wild; the adapter accepts both:

**(a) Character-Book v2 (canonical):**
```
character_book: {
  name?, description?, scan_depth?, token_budget?, recursive_scanning?, extensions,
  entries: [{
    keys: string[], content: string, enabled: bool, insertion_order: number,
    case_sensitive?: bool, name?, priority?, id?, comment?,
    selective?: bool, secondary_keys?: string[], constant?: bool,
    position?: 'before_char' | 'after_char', extensions
  }]
}
```

**(b) SillyTavern World-Info superset** (as seen in the prior upload) — a flat entry array with the
extra fields: `keysecondary[]`, `selectiveLogic` (int), `probability`, `groupWeight`, `minMessages`,
`activationMode`, `matchWholeWords`, `keyMatchPriority`, `inclusionGroupRaw`, `*Raw` mirrors, and
`activationScript`.

### 1.1 Field study (what each controls)

| Concern | Janitor/ST fields | Meaning |
|---|---|---|
| **Entry schema** | `id`, `content`, `name`/`comment` | identity + injected text + author note |
| **Trigger system** | `keys`/`key[]`, `keysecondary`/`secondary_keys`, `case_sensitive`, `matchWholeWords` | primary + secondary keyword matching |
| **Activation rules** | `constant`/`activationMode`, `enabled`, `selective`+`selectiveLogic`, `probability`, `minMessages` | always-on, on/off, selective logic, stochastic + delay gates |
| **Priority system** | `insertion_order`, `priority`, `groupWeight`, `keyMatchPriority` | ordering + weight under budget |
| **Context injection** | `position` (`before_char`/`after_char`), book `token_budget`, `scan_depth`, `recursive_scanning` | placement + budget + scan window + recursion |
| **Executable (danger)** | `activationScript` | a script hook — **security-sensitive** |

## 2. Field mapping → generic `LoreEntry`

| Janitor / ST field | Generic field | Notes |
|---|---|---|
| `keys` / `key[]` | `keys` | primary triggers |
| `secondary_keys` / `keysecondary[]` | `secondaryKeys` | |
| `selective` (bool) + `selectiveLogic` (int) | `selectiveLogic` enum | 0→andAny,1→andAll,2→notAny,3→notAll; `selective:false` ⇒ omit |
| `content` | `content` | **sanitized + injection-scanned** (§4) |
| `constant` / `activationMode` (always) | `alwaysActive` | |
| `enabled` | `enabled` | |
| `case_sensitive` | `caseSensitive` | |
| `matchWholeWords` | `matchWholeWords` | default true |
| `insertion_order` | `order` | |
| `priority` / `groupWeight` | `priority` | |
| `probability` | `probability` | clamp 0..100 (default 100) |
| `minMessages` | `minMessages` | |
| `position` | `position` | `before_char`/`after_char`; unknown → `after_char` |
| `id` | `id` | regenerated if missing/duplicate |
| `name` / `comment` | `comment` | author note, **never injected** |
| `tags[]` | `tags` | |
| `extensions`, `*Raw`, `keyMatchPriority`, `inclusionGroupRaw` | — | ignored (forward compatible) |
| **`activationScript`** | — | **DROPPED — never imported or executed** (§4) |
| — | `whenRelationship` / `whenMemory` / `relationshipEffectOnReveal` / `promoteToMemoryOnReveal` | **not present in Janitor**; default unset (authored later in NamoChat) |

Book-level: `name→book.name`, `scan_depth→scanDepth`, `token_budget→tokenBudget`,
`recursive_scanning→recursiveScanning`, `source:'janitor'`, `trusted:false`.

## 3. Scope assignment

Janitor lorebooks are authored per character or as world info, so the adapter defaults imported
books to **`character`** scope when attached to a character import, else **`world`** scope, and lets
the user re-assign to `world`/`scenario`/`private` on import. Relationship/memory gates are **not**
in the source, so imported entries have none by default — the user can add `whenRelationship`
conditions afterward (that's the NamoChat value-add, not part of the import).

## 4. Security (mandatory — same discipline as Scenario Packs)

Imported lorebooks are **untrusted**:
- **Injection scan** every `content` (reusing the scenario-pack scanner). Entries resembling system
  overrides (`override`, `ignore previous instructions`, `BEGIN OVERRIDE`, `debug session`, role
  markers, instruction terminators) are imported `blocked:true`/`blockReason`, **never injected**,
  and listed in an import report. (The prior upload's `debug` entry is the archetype.)
- **Drop executable fields:** `activationScript` and any hook are removed, never stored or run —
  lore is data, never code.
- **Data-only envelope + persona supremacy:** at injection, untrusted lore is wrapped as reference
  data and always sits **below** the persona lock, trimmed first under budget.
- `trusted:false` on the whole book.

## 5. Validation & normalization

- Accept both format shapes; normalize `*Raw` mirrors to their parsed arrays; regenerate missing/
  duplicate ids; clamp `probability`; coerce `selectiveLogic` int→enum.
- Reject/repair malformed entries (empty content after sanitization ⇒ dropped with a report note).
- Size guards (max entries, max content length) to bound storage/token cost.
- Deterministic + offline (no LLM needed to import).

## 6. Adapter surface (specification)

```ts
interface JanitorImportResult {
  book: LoreBook;                 // scope defaulted, trusted:false
  report: {
    total: number; imported: number;
    blocked: { id: string; reason: string; sample: string }[];
    droppedScripts: number; repaired: number;
  };
}
declare function importJanitorLorebook(
  json: unknown,
  opts?: { scope?: LoreScope },   // default 'character'
): JanitorImportResult;
```

## 7. Out of scope

Implementation, a `{random:...}` renderer, recursive-scan tuning, and actually importing the sample
content. **Design only — stop after design.**
