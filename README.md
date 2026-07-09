# NamoChat

A premium, personal-use **AI roleplay chat platform** — original architecture and UI, built by
consolidating the reusable modules of the NaMo ecosystem repositories
(see [docs/MIGRATION.md](docs/MIGRATION.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

> **Canonical repository.** NamoChat was extracted from its Foundation incubation in
> `sovereign-platform-v3` (tagged `foundation`) into this independent product. The seven
> NaMo-ecosystem repositories are now **read-only migration references**. See
> [docs/MIGRATION_REPORT.md](docs/MIGRATION_REPORT.md) for what was imported, rewritten, and removed.

Local-first: no server, no accounts, no payments. Chats, characters and API keys live in your
browser; model requests go directly to the provider you configure.

## Features (Phase 1)

- 🎭 **Character cards** — create, edit, export, and import (native + SillyTavern v2 JSON)
- 💬 **Multiple chats** with search, export/import, edit / regenerate / continue
- 🌊 **Streaming replies** with Markdown (and image) rendering, abortable mid-stream
- 🧠 **Long-term memory** — lifecycle-managed memory records with lexical recall and
  emotion-weighted reinforcement; world memories shared across chats
- ❤️ **Relationship progression** — configurable stages + attachment styles, driven by a pure
  affect-vector **emotion engine** (visible live in the chat header)
- 📖 **Lore engine** (keyword-triggered world entries) and **story timeline** recap injection
- 🔀 **Multi-model router** — Claude, Gemini, GPT, DeepSeek, OpenRouter, Ollama, LM Studio,
  plus a zero-config offline mock provider

## Stack

TypeScript · React 18 · Vite · TailwindCSS 4 · Zustand · React Query · Vitest

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # core engine unit tests
npm run build      # production bundle
```

Open **Settings** to pick a provider and paste an API key (or point at a local
Ollama/LM Studio server). Without configuration, the offline mock provider keeps
everything usable.
