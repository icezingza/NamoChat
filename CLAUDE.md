# CLAUDE.md — NamoChat

Premium, personal-use **AI roleplay chat platform**. Local-first browser app (no server, no auth,
no payments). Built by consolidating the NaMo ecosystem repos — see `docs/MIGRATION.md`.

## Priority order (never violate)

1. **Character Consistency** — persona must never drift. `consistencyRules` and the character's
   system-prompt override are always injected and never budget-trimmed.
2. **Memory** — never lose or corrupt memory. Error text and internal directives never become
   memories. Lifecycle (ACTIVE→ARCHIVED→FORGOTTEN) is enforced in the domain object.
3. **Roleplay quality** — every feature must improve the roleplay.
4. **UI/UX** · 5. **Performance** · 6. **Clean code**.

## Commands

```bash
npm run dev     # vite dev server (5173)
npm run build   # tsc -b + vite build
npm test        # vitest — core engine unit tests
npm run typecheck
```

## Architecture (Clean Architecture, feature-based)

```
core/     framework-free domain + application logic. NO React/DOM/storage imports.
stores/   Zustand (application layer). Owns persistence via lib/storage + guardedStorage.
features/ React UI, one folder per feature. Talks to stores + core types only.
components/ui/  small shadcn-style primitives.
lib/      storage guard, cn(), id(), file download.
```

Hard rules (enforced across the codebase):

1. `core/` is framework-free and unit-testable in isolation (Vitest).
2. **No monolithic prompt strings.** Persona is data (`CharacterCard` + `IdentityBlueprint`).
   Only `core/prompt/prompt-builder.ts` turns data into the system prompt; only
   `context-builder.ts` assembles the per-turn block.
3. **Every per-turn context insertion is `TokenBudget`-gated.** Mandatory items (system prompt,
   persona/consistency block, history) are never trimmed; optional items (memory, lore, recap)
   are dropped first when over budget.
4. **Providers are ports.** UI/stores call `createProvider()` — never import a concrete provider.
   New backend = one file in `core/providers/` + one entry in `model-router.ts`.
5. **Storage is failure-tolerant.** `guardedStorage`/`lib/storage.ts` degrade to in-memory on
   quota/private-mode failures instead of throwing.
6. **State changes via behavior methods, not setters** (`MemoryRecord.archive()`, etc.).

## Turn pipeline (`stores/chat-pipeline.ts`)

`user text → emotion signals → EmotionEngine (update+decay) → RelationshipEngine.progress →
SoulCore.derivePersonaState → MemoryEngine recall (semantic w/ lexical fallback) + LoreEngine.match →
ContextBuilder (budget-gated) → provider.streamChat → CognitiveStreamParser → save memory + timeline`.

- Emotion/relationship advance **synchronously** in message order (donor-repo rule).
- `runTurn(..., skipUserMemory)`: regenerate/continue never duplicate the user memory or store
  the internal continue directive; failed requests never save error text as a memory.
- Embedding is best-effort (`safeEmbed`): a failed embed falls back to lexical recall and saves
  the record without a vector.

## Core modules

| Module | File | Notes |
|---|---|---|
| Character Engine | `core/character/character.ts` | Card schema, validation, import (native + SillyTavern v2), alt greetings, system-prompt override |
| Identity Capsule | `core/identity/identity-capsule.ts` | `getSystemContext()` (once/chat), `getDistilledContext()` (per turn) |
| Soul Core | `core/soul/soul-core.ts` | Fuses identity + affect + relationship → `PersonaState` |
| Emotion Engine | `core/emotion/emotion-engine.ts` (+ `signal-extractor.ts`) | Pure affect vector, inertia + decay |
| Relationship Engine | `core/relationship/relationship-engine.ts` | Configurable stages + attachment styles |
| Memory Engine | `core/memory/{memory-record,memory-engine}.ts` | Lifecycle + lexical (unicode) + semantic recall + weighting |
| Lore Engine | `core/lore/lore-engine.ts` | Keyword-triggered + always-active entries |
| Story Timeline | `core/timeline/story-timeline.ts` | Chronological beats + recap injection |
| Prompt/Context | `core/prompt/{prompt-builder,context-builder,token-budget}.ts` | System prompt + budget-gated per-turn block |
| Cognition | `core/cognition/stream-parser.ts` | Strips `<cognitive_stream>` blocks incrementally |
| Providers | `core/providers/*` | Port + Claude/Gemini/OpenAI-compatible/mock + router |

## Testing

- Colocated `*.test.ts` under `src/core/**`; `npm test` runs fully offline.
- Add a test alongside new pure logic. Never inspect private fields; test public API only.

## Sprint log

- **Phase 1** — foundation (see `docs/MIGRATION.md`, PR #16). 26 tests.
- **Phase 2** — depth:
  - Character Consistency: `systemPromptOverride` ({{user}}/{{char}} substitution),
    `buildPersonaLock` (consistency rules injected every turn, never budget-trimmed),
    alternate greetings (`pickGreeting`), example dialogue anchored in the system prompt.
  - Memory: semantic recall wired via best-effort `safeEmbed` (cosine when embeddings
    available, lexical fallback); query vector reused for the user memory, reply embedded.
    Memory inspector (pin/forget/world-memory) via `MemoryEngine.pin/forgetOne/listFor`.
  - Roleplay/UI: world-lore editor, story-timeline UI + milestone pinning, image messages,
    chat branching (`forkChat`, chatId remapped for per-chat recall). 32 tests.
- **Phase 3** — polish: PWA (`public/{manifest.webmanifest,sw.js,icon.svg}`, SW registered in
  prod only; cross-origin model calls never intercepted), windowed chat render (`WINDOW_SIZE`
  + load-earlier), view-transition + reduced-motion animation pass. Backup encryption deferred
  (low roleplay value).
