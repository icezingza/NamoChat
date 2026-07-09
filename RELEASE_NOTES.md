# NamoChat — Release Notes

## v0.1.0 — Foundation (2026-07-09)

First public release of **NamoChat**, the canonical, independent AI roleplay chat platform.
This is the extracted Foundation: everything built across Phases 1–3 during incubation in
`sovereign-platform-v3` (tag `foundation`, merge `53a9b10`), lifted into this standalone repo
and verified building and testing on its own.

### Highlights

**Roleplay core (framework-free, unit-tested)**
- Character Engine — card schema, validation, import (native + SillyTavern v2), alternate
  greetings, per-character system-prompt override.
- Identity Capsule + Soul Core — persona fused with live affect and relationship state.
- Emotion Engine — pure affect vector (valence/arousal/trust/passion/resonance) with inertia + decay.
- Relationship Engine — configurable stages + attachment styles, driven by affect.
- Memory Engine — lifecycle records (ACTIVE→ARCHIVED→FORGOTTEN), unicode lexical + semantic
  (cosine) recall, emotion-weighted reinforcement, world memory.
- Lore Engine, Story Timeline — keyword-triggered world knowledge + chronological story beats.
- Prompt/Context builders — one system prompt per chat, budget-gated per-turn context, and a
  **persona lock** (consistency rules that are never trimmed).
- Cognition — incremental `<cognitive_stream>` stripper.

**Multi-model router**
- Claude, Gemini, GPT, DeepSeek, OpenRouter, Ollama, LM Studio, and an offline mock — all
  streaming and abortable, behind one provider port.

**App (dark, mobile-first)**
- Character gallery / profile / editor; multiple chats with search and export/import.
- Streaming Markdown messages; edit / regenerate / continue; image messages; chat branching.
- Memory inspector (pin / forget / add world memory) and story-timeline view.
- PWA offline shell; windowed rendering for long chats; view-transition animations.

### Character-consistency & memory guarantees
- Persona lock and system-prompt override are always injected and never budget-trimmed.
- Error text and internal directives never persist as long-term memories.
- Regenerate/continue never duplicate the user memory.

### Excluded by design
No payments, tokens, coins, subscriptions, marketplace, ads, social feed, or multi-user auth.
Local-first: no server, no accounts; model requests go directly from the browser to the provider.

### Quality
- 32 core-engine unit tests (Vitest), clean `tsc -b`, clean production build.
- Verified by cloning the published `main` and running the suite from scratch.

### Provenance
Consolidated from seven NaMo-ecosystem repositories; duplication collapsed (4 emotion engines→1,
3 memory systems→1, 3 identity systems→1, 5 persona engines→1 card format). Full detail in
[docs/MIGRATION_REPORT.md](docs/MIGRATION_REPORT.md).

### Known issues / notes
- The `foundation` and `v0.1.0` tags and the GitHub Release are pending — the current
  automation environment's git proxy does not permit pushing tag refs and exposes no
  release-creation API. The tags exist in the source bundle; see PROJECT_STATUS.md for the
  one-command remediation.
