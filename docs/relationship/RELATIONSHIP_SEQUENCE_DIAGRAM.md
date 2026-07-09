# Relationship Engine — Sequence Diagrams (v0.2.0)

Design-only. Shows where the engine sits in the existing turn pipeline
(`stores/chat-pipeline.ts`) and how events, projections, snapshots, and branching interact. The
**pure core** (RelationshipEngine, projections) never touches storage/LLM; the **application layer**
(pipeline + repository + detector) orchestrates.

## 1. Per-turn flow (send message)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant UI as ChatScreen
  participant PIPE as chat-pipeline (app)
  participant SIG as signal-extractor (core)
  participant DET as EventDetector (app)
  participant MEM as MemoryEngine (core)
  participant REL as RelationshipEngine (core, pure)
  participant EMO as EmotionEngine (core)
  participant SOUL as SoulCore.derivePersonaState (core)
  participant CTX as ContextBuilder (core)
  participant PROV as ModelProvider (port)
  participant REPO as RelationshipRepository (app/storage)

  U->>UI: submit text
  UI->>PIPE: runTurn(chat, character, text)
  PIPE->>SIG: extractSignals(text)
  SIG-->>PIPE: {toneScore, conflictLevel}

  Note over PIPE,REPO: load current edge (hot vector inline on chat)
  PIPE->>REL: applyAmbient(vector, signals)   %% capped: familiarity↑, conflict/fear decay
  REL-->>PIPE: vector'

  PIPE->>DET: detect(text, signals, recalledMemories)
  DET-->>PIPE: RelationshipEvent[] (auto-detected, low weight)
  loop for each event (this-turn + memory-derived)
    PIPE->>REL: applyEvent(vector', event)
    REL-->>PIPE: vector''
  end

  PIPE->>REL: projectStage/overlay/attachment(vector'')
  REL-->>PIPE: {stage, overlay, attachmentStyle, directives, narrationTone}
  PIPE->>EMO: updateAffect(affect, signals, relationshipBaselineBias(vector''))
  EMO-->>PIPE: affect'
  PIPE->>MEM: recall(...)  %% already in pipeline
  PIPE->>SOUL: derivePersonaState(identity, affect', vector'' projections)
  SOUL-->>PIPE: PersonaState (persona lock + relationship directives)
  PIPE->>CTX: buildTurnContext(personaLock, directives, memories, lore, recap) [budget-gated]
  CTX-->>PIPE: context block
  PIPE->>PROV: streamChat(system, context, history)
  PROV-->>UI: streamed reply (via StreamParser)

  Note over PIPE,REPO: persist AFTER the turn resolves
  PIPE->>REPO: append(events), putSnapshot(vector''), update edge.vector
  PIPE->>PIPE: patchChat({relationship: vector'', timeline += stageChange?})
```

Notes:
- **Ambient before events:** decay/familiarity first, then discrete events, so an apology in the same
  turn as its argument resolves against the freshest state.
- **Emotion reads relationship (one-way):** `relationshipBaselineBias` shifts the affect baseline
  (SPEC §7.6) — the two pure modules stay decoupled (bias is passed, not imported).
- **Persist last:** like the v0.1 pipeline, memory/relationship writes happen after the reply so a
  failed request never corrupts state; error text never becomes an event or memory.

## 2. User pins a meaningful event (authoritative)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant UI as ChatSidePanel / message action
  participant PIPE as app
  participant REL as RelationshipEngine (pure)
  participant REPO as RelationshipRepository

  U->>UI: "Mark moment" → pick type (e.g. confession_love), weight (pivotal)
  UI->>PIPE: pinEvent({type, weight, atMessageId})
  PIPE->>REL: applyEvent(vector, event{source:'user-pinned', confidence:1})
  REL-->>PIPE: vector'
  PIPE->>REPO: append(event), putSnapshot(vector'), update edge
  PIPE->>UI: timeline += event; relationship panel updates
```

User-pinned events are `confidence = 1` and may be `pivotal` — the only routine path to large,
intended changes (auto-detection stays low-weight by design).

## 3. Memory → Relationship (memory-derived event)

```mermaid
sequenceDiagram
  autonumber
  participant MEM as MemoryEngine / store
  participant PIPE as app
  participant REL as RelationshipEngine (pure)
  participant REPO as RelationshipRepository

  Note over MEM: a memory saved with emotionWeight ≥ threshold, or a pinned/world memory added
  MEM-->>PIPE: high-salience memory notification
  PIPE->>PIPE: map memory → RelationshipEvent(source:'memory-derived', moderate)
  PIPE->>REL: applyEvent(vector, event)
  REL-->>PIPE: vector'
  PIPE->>REPO: append + snapshot
```

## 4. Branching a chat (snapshot fork)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant UI as MessageBubble (branch)
  participant CHAT as chat-store.forkChat
  participant REPO as RelationshipRepository

  U->>UI: "Branch from here" (messageId)
  UI->>CHAT: forkChat(chatId, messageId)
  CHAT->>REPO: copy edge+ledger+snapshots up to messageId into new scopeId
  Note over REPO: new Timeline{ parentTimelineId, forkedAtMessageId }
  CHAT-->>UI: navigate to branch (independent edge; diverges from here)
```

Two branches from the same point share history only up to the fork (invariant B1); events after the
fork accrue to their own scope.

## 5. Greeting selection on new chat (Relationship → Greeting)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant UI as CharacterProfile / Gallery
  participant PIPE as app
  participant REL as RelationshipEngine (pure)

  U->>UI: "Start new chat"
  Note over PIPE: for a brand-new chat, vector = policy.startingVector ?? defaults
  UI->>REL: selectGreeting(card, vector)  %% stage/dimension-aware
  REL-->>UI: chosen greeting variant / tone hint
  UI->>PIPE: createChat(..., greeting)
```

For a **continued relationship** (e.g. a returning scope or a future persistent character-level
edge), `selectGreeting` reads the existing vector so the opener matches the current stage/overlay.
