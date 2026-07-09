# Relationship Engine — API Contract (v0.2.0)

Design-only. Declares the **public contracts** (types + signatures) for the engine, projections,
repository, and detector. These are **specifications, not implementations** — method bodies are
described, not written. Naming follows the existing `core/` conventions.

## 1. Layering

```
core/relationship/           PURE — no storage/DOM/LLM
  relationship-vector.ts       types + constants (RelationshipVector, defaults, config)
  relationship-engine.ts       applyAmbient / applyEvent / replay  (pure)
  relationship-events.ts       event taxonomy + default delta templates
  relationship-projection.ts   stage / overlay / attachment / directives / greeting / narration
services/                    ADAPTERS — persistence + detection
  relationship-repository.ts   RelationshipRepository interface + adapters (IndexedDB, in-memory)
  relationship-detector.ts     EventDetector (deterministic; optional LLM classifier behind port)
```

The pure files import **nothing** from `stores/`, `services/`, React, or any SDK (enforced by the
same rule as the rest of `core/`).

## 2. Core types (specification)

```ts
type Dimension =
  | 'trust' | 'affection' | 'respect' | 'attachment' | 'dependence'
  | 'familiarity' | 'romanticInterest' | 'conflict' | 'fear';

interface RelationshipVector { /* nine numbers ∈ [0,1] — one per Dimension */ }

type EventWeight = 'minor' | 'moderate' | 'major' | 'pivotal';
type EventSource = 'user-pinned' | 'auto-detected' | 'memory-derived' | 'system';

interface RelationshipEvent {
  id: string;
  edgeId: string;
  scopeId: string;              // timeline / chat id
  atMessageId?: string;
  timestamp: number;
  type: string;                 // taxonomy key (RELATIONSHIP_ENGINE_SPEC §4.1)
  weight: EventWeight;
  deltas?: Partial<Record<Dimension, number>>;   // overrides the type's template
  source: EventSource;
  confidence?: number;          // 0..1 (auto-detected); default 1
  note?: string;
}

interface CharacterRelationshipPolicy {
  allowRomance?: boolean;
  romanceGateTrust?: number;
  startingVector?: Partial<RelationshipVector>;
  dimensionCaps?: Partial<Record<Dimension, [number, number]>>;
  decayProfileOverride?: Partial<Record<Dimension, DecayProfile>>;
}

interface RelationshipConfig { /* all tunables (SPEC §9); a frozen default is exported */ }
```

## 3. Pure engine API

```ts
// relationship-vector.ts
declare function createInitialVector(policy?: CharacterRelationshipPolicy): RelationshipVector;

// relationship-engine.ts — all PURE (input vector never mutated; a new vector is returned)
declare function applyAmbient(
  vector: RelationshipVector,
  signals: EmotionSignals,            // reuse core/emotion EmotionSignals
  config?: RelationshipConfig,
): RelationshipVector;                 // caps sticky dims (SPEC A1), decays conflict/fear, grows familiarity

declare function applyEvent(
  vector: RelationshipVector,
  event: RelationshipEvent,
  policy?: CharacterRelationshipPolicy,
  config?: RelationshipConfig,
): RelationshipVector;                 // weight × confidence × resistance, gates + couplings last

declare function replay(
  seed: RelationshipVector,
  events: RelationshipEvent[],         // ordered
  policy?: CharacterRelationshipPolicy,
  config?: RelationshipConfig,
): RelationshipVector;                 // fold applyEvent over events — reconstruct any point (SPEC §8)

// relationship-events.ts
declare function eventTemplate(type: string): Partial<Record<Dimension, number>>;
declare function effectiveDeltas(event: RelationshipEvent): Partial<Record<Dimension, number>>;
```

## 4. Projection API (pure, read-only)

```ts
// relationship-projection.ts — none of these mutate the vector
declare function netBond(v: RelationshipVector, config?: RelationshipConfig): number;   // 0..1

interface StageProjection {
  stage: string;                 // 'Stranger'|'Acquaintance'|'Companion'|'Intimate'|'Devoted' (or romantic labels)
  romantic: boolean;
  overlay: 'Normal'|'Rupture'|'Fearful'|'Obsessive'|'Estranged'|'Reconciling';
}
declare function projectStage(
  v: RelationshipVector,
  previous?: StageProjection,    // for hysteresis / one-band-per-eval (SM2)
  config?: RelationshipConfig,
): StageProjection;

type AttachmentStyle = 'secure'|'anxious'|'possessive'|'avoidant'|'fearful';
declare function projectAttachmentStyle(v: RelationshipVector): AttachmentStyle;

// Prompt / narration / emotion conditioning (SPEC §7)
interface RelationshipDirectives {
  stageDirective: string;        // compact; rides the never-trimmed persona region
  attachmentDirective: string;
  narrationTone: string;         // warmth / tension / distance hint
  dimensionNotes: string;        // e.g. "wary (fear), candid (trust)"
}
declare function projectDirectives(
  v: RelationshipVector,
  stage: StageProjection,
  attachment: AttachmentStyle,
  config?: RelationshipConfig,
): RelationshipDirectives;

declare function relationshipBaselineBias(v: RelationshipVector): Partial<AffectVector>; // Rel → Emotion

// Greeting (Relationship → Greeting) — replaces v0.1 pickGreeting
declare function selectGreeting(
  card: CharacterCard,
  v: RelationshipVector,
  random?: () => number,
): string;
```

### 4.1 Compatibility shim (keeps v0.1 consumers working)

`soul-core.derivePersonaState` currently expects `stageName`, `stageDirective`,
`attachmentDirective`. A thin adapter exposes exactly those from the new projections so `soul-core`
and `context-builder` need **no change** during migration:

```ts
declare function toPersonaInputs(v: RelationshipVector, prev?: StageProjection): {
  stageName: string; stageDirective: string; attachmentDirective: string;
  narrationTone: string; dimensionNotes: string;
};
```

## 5. Repository API (adapter — impure, swappable)

Mirrors `MemoryRepository`: an interface with an IndexedDB adapter and an in-memory adapter for
tests/dev. Degrades to in-memory on storage failure (guarded), never throws into the caller.

```ts
interface RelationshipRepository {
  getEdge(scopeId: string, sourceId: string, targetId: string): Promise<RelationshipEdge | null>;
  putEdge(edge: RelationshipEdge): Promise<void>;               // upsert hot vector + caches
  appendEvents(events: RelationshipEvent[]): Promise<void>;     // append-only (DB2)
  listEvents(edgeId: string, opts?: { since?: number; limit?: number }): Promise<RelationshipEvent[]>;
  putSnapshot(snap: RelationshipSnapshot): Promise<void>;
  latestSnapshot(edgeId: string): Promise<RelationshipSnapshot | null>;
  listSnapshots(edgeId: string): Promise<RelationshipSnapshot[]>;
  forkScope(fromScopeId: string, toScopeId: string, uptoMessageId?: string): Promise<void>; // branch (B1)
  deleteScope(scopeId: string): Promise<void>;                  // cascade (DB4)
}
```

## 6. Detector API (adapter — deterministic; optional LLM later)

```ts
interface EventDetector {
  detect(input: {
    text: string;
    signals: EmotionSignals;
    recalledMemories?: MemorySearchResult[];   // raise confidence (SPEC §5.4)
    edgeId: string; scopeId: string; atMessageId?: string;
  }): RelationshipEvent[];   // low-to-moderate weight, confidence < 1; empty when nothing salient
}
```

- v0.2 ships a **deterministic** keyword/intent detector (extends `signal-extractor`), fully offline
  and unit-testable.
- An optional LLM-backed detector may implement the same interface later, behind the provider port,
  and must never block or fail a turn.

## 7. Contract guarantees

- **API1** Every pure function is deterministic and returns a new value (no mutation of inputs).
- **API2** `applyAmbient`/`applyEvent`/`replay` keep all dimensions in `[0,1]` and apply
  policy/couplings last (SPEC G1).
- **API3** Projections are pure and side-effect-free (SPEC C1).
- **API4** Repository/detector are the *only* impure pieces; they are interfaces with swappable
  adapters and never leak storage errors to the core.
- **API5** The compatibility shim preserves the exact fields `derivePersonaState` consumes so the
  migration is non-breaking (MIGRATION_PLAN §Phase A).
