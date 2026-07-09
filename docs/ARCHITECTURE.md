# NamoChat — Architecture

A premium, personal-use AI roleplay chat platform. Local-first browser app: no server,
no auth, no payments. All state lives in the browser (guarded `localStorage`); all model
calls go straight from the client to the configured provider.

## Layering (Clean Architecture)

```
core/        ← pure domain + application logic. NO React, NO DOM, NO storage imports.
   ↑
stores/      ← Zustand state (application layer). Owns persistence via lib/storage.
   ↑
features/    ← React UI, feature-based folders. Talks only to stores + core types.
```

Rules (inherited from the donor repos and enforced here):

1. **`core/` is framework-free.** Every engine is unit-testable with plain Vitest — no
   `window`, no `localStorage`, no React import anywhere under `src/core/`.
2. **No monolithic prompt strings.** Persona is data: `CharacterCard` + `IdentityBlueprint`.
   Only `prompt-builder.ts` turns data into prompt text.
3. **Every prompt insertion is token-budget gated** (`context-builder.ts`); nothing is
   appended to a request without passing through `TokenBudget`.
4. **Providers are ports.** UI/stores never import a concrete provider; they call
   `createProvider()` from the model router. Adding a backend = one new file + one
   registry entry.
5. **Storage is swappable and failure-tolerant.** `lib/storage.ts` wraps `localStorage`
   in try/catch; a quota/private-mode failure degrades to in-memory for the session.
6. **State changes via behavior, not setters** (sovereign-platform discipline):
   `MemoryRecord.archive()`, `RelationshipState` transitions, etc.

## Directory Layout

```
namochat/
├── docs/                    MIGRATION.md, ARCHITECTURE.md
├── src/
│   ├── core/                framework-free engines
│   │   ├── character/       CharacterCard schema, validation, import (native + SillyTavern v2)
│   │   ├── identity/        IdentityCapsule (persona → system/distilled context)
│   │   ├── soul/            SoulCore — fuses identity + affect + relationship into PersonaState
│   │   ├── emotion/         EmotionEngine (affect vector) + signal extractor
│   │   ├── relationship/    RelationshipEngine (stages + attachment styles)
│   │   ├── memory/          MemoryRecord + MemoryEngine (lexical/semantic search, weighting)
│   │   ├── lore/            LoreEngine (keyword-triggered world entries)
│   │   ├── timeline/        StoryTimeline (chronological story events)
│   │   ├── prompt/          TokenBudget, PromptBuilder (system), ContextBuilder (per turn)
│   │   ├── cognition/       StreamParser (strips <cognitive_stream> blocks)
│   │   └── providers/       ModelProvider port + Claude/Gemini/OpenAI-compatible + router
│   ├── stores/              Zustand: characters, chats, settings (persisted)
│   ├── features/
│   │   ├── chat/            ChatScreen, MessageBubble, MessageInput, ChatList
│   │   ├── characters/      CharacterGallery, CharacterProfile, CharacterEditor
│   │   └── settings/        provider/model configuration
│   ├── components/ui/       small shadcn-style primitives (Button, Input, …)
│   └── lib/                 storage guard, cn(), id()
└── tests → colocated *.test.ts under src/core/**
```

## Chat Turn Pipeline

```
user text
  → emotion signals (signal-extractor)                 [pure]
  → EmotionEngine.updateAffect + applyDecay            [pure]
  → RelationshipEngine.progress(affect)                [pure]
  → SoulCore.derivePersonaState(identity, affect, rel) [pure]
  → MemoryEngine.search(query) + LoreEngine.match(text)
  → ContextBuilder.assemble(...)  — TokenBudget-gated
  → ModelProvider.streamChat(messages, onChunk, signal)
  → StreamParser per chunk → visible text → UI bubble
  → save turn to memory, record timeline event
```

## Multi-Model Router

`ProviderKind = 'claude' | 'gemini' | 'openai' | 'deepseek' | 'openrouter' | 'ollama' | 'lmstudio' | 'mock'`

- Claude → Anthropic Messages API (`anthropic-dangerous-direct-browser-access`), SSE.
- Gemini → `streamGenerateContent?alt=sse`.
- GPT / DeepSeek / OpenRouter / Ollama / LM Studio → one `OpenAICompatibleProvider`
  parameterized by base URL (+ optional key).
- `mock` → offline deterministic provider so the app runs with zero configuration.

All providers implement:

```ts
interface ModelProvider {
  streamChat(req: ChatRequest, onChunk: (t: string) => void, signal?: AbortSignal): Promise<ChatResult>;
  generateEmbedding?(text: string): Promise<number[]>;
}
```

Streams are abortable (`AbortSignal`) — Stop/Regenerate cancels the in-flight request.
