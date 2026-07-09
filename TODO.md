# NamoChat — TODO

Sequenced by project priority: **1 Character Consistency · 2 Memory · 3 Roleplay · 4 UI/UX · 5 Performance · 6 Clean Code.**
Never sacrifice character consistency; never break memory.

## Phase 1 — Foundation ✅ (PR #16)

- [x] Repo analysis + migration doc + architecture doc
- [x] Core engines (character, identity, soul, emotion, relationship, memory, lore, timeline, prompt, cognition, providers)
- [x] Multi-model router (Claude/Gemini/OpenAI-compatible + mock), streaming, abortable
- [x] Zustand stores + guarded localStorage; turn pipeline
- [x] Dark mobile-first UI; gallery/profile/editor; multi-chat; search; export/import; edit/regenerate/continue
- [x] 26 unit tests; browser smoke test
- [x] Review fixes: memory-pollution guards, unicode search, deferred URL revoke

## Phase 2 — Depth (in progress)

### 2A · Character Consistency (priority 1)
- [x] Per-character **system-prompt override** (advanced field, replaces the default preamble when set)
- [x] **Alternate greetings** (first-message variants) — choose/shuffle when starting a chat
- [x] **Persona lock** — identity `consistencyRules` always injected, never budget-trimmed
- [x] Example-dialogue always in the system prompt (few-shot anchoring)

### 2B · Memory Quality (priority 2)
- [x] Wire **semantic embeddings** into the turn pipeline (best-effort `safeEmbed`, store vector on each memory, cosine recall with lexical fallback)
- [x] **Memory inspector/editor** — view, pin (weight↑), forget records per chat
- [x] **World memory** authoring (persistent facts shared across a character's chats)

### 2C · Roleplay Quality (priority 3)
- [x] **Lore editor** UI (keyword-triggered + always-active entries) on the character
- [x] **Story timeline** UI (chronological beats) + manual milestone pinning

### 2D · UI/UX (priority 4)
- [x] **Image messages** — attach an image URL/data-URI to a user turn
- [x] Character profile media polish; timeline/lore/memory surfaced in-app

## Phase 3 — Polish

- [x] Animation/transition pass (view transitions, message stagger)
- [x] **Virtualized** long chats (windowed render) for performance
- [x] **Chat branching** (fork a chat from any message)
- [x] **PWA**/offline packaging (manifest + service worker)
- [ ] Backup encryption (deferred — optional, low roleplay value)

## Continuous
- [x] Maintain TODO.md + namochat/CLAUDE.md
- [x] Commit per milestone; refactor over rebuild
