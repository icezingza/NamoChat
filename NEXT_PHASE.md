# NamoChat — Next Phase (Phase 4) — PLAN ONLY, NOT STARTED

> This document scopes the next phase. **No Phase 4 work has begun.** It exists so the direction
> is recorded at the Foundation boundary. Sequence any future work by the project priority order:
> **1 Character Consistency · 2 Memory · 3 Roleplay · 4 UI/UX · 5 Performance · 6 Clean Code.**

## Theme: from "works" to "durable & shareable"

The Foundation is a complete, single-user, local-first roleplay client. Phase 4 should deepen the
three things that most improve long-running roleplay — persistent memory quality, character
fidelity, and portability — without adding a server, accounts, or monetization.

## Candidate workstreams (priority-ordered)

### 4A · Memory durability & recall quality (priority 2)
- **Memory summarization / consolidation**: fold old turns into durable summaries so long chats
  keep salient history without unbounded growth (compaction, not loss).
- **Cross-chat character memory**: promote high-weight facts to a per-character store shared
  across that character's chats (today only explicit "world" memories are shared).
- **Embedding cache**: persist embeddings already computed to avoid re-embedding on reload.

### 4B · Character fidelity (priority 1)
- **Consistency self-check**: optional lightweight post-generation check that a reply didn't
  violate `consistencyRules`, with a regenerate hint (never auto-editing the persona).
- **Card versioning**: track edits to a character so existing chats can pin the card version
  they began with, preventing mid-story personality drift.

### 4C · Roleplay depth (priority 3)
- **Author's-note / scene direction**: a per-chat steering field injected at controlled depth.
- **Group chats**: more than one character in a scene, with turn arbitration.

### 4D · Portability & data safety (priority 4–5)
- **Full backup/restore** of all stores in one file (characters + chats + settings), and the
  deferred **encrypted backup**.
- **Provider connection test** button in Settings (validate key/endpoint before first message).

### 4E · Performance (priority 5)
- True windowed virtualization for very long chats (measured before/after).
- Lazy-load provider modules per selected backend.

## Explicitly out of scope (unchanged)
Payments, tokens, subscriptions, marketplace, ads, social feed, multi-user auth, or any
server-side account system. NamoChat stays local-first.

## Entry criteria for starting Phase 4
1. Tags `foundation` / `v0.1.0` and the v0.1.0 Release are live on the canonical repo.
2. CI is green on `main`.
3. A Phase 4 scope is chosen from the workstreams above and written into `TODO.md`.
