# Relationship Engine — Specification (v0.2.0)

Design-only. Defines behavior, data shapes (as **specification**, not implementation), and the
algorithms the engine must satisfy. Companion to ADR-0004.

## 1. Purpose & principles

The Relationship Engine models the durable, multi-faceted relationship between two actors and
exposes it to prompt/greeting/narration/emotion generation. It obeys:

- **P1 — Not a score.** State is a vector of nine independent dimensions.
- **P2 — Events drive change.** Conversation has *limited, capped* effect; meaningful events carry
  weight.
- **P3 — Pure core.** Deterministic pure functions; no storage/DOM/LLM/network in `core/`.
- **P4 — Derived stages.** Human-facing "stage"/"attachment style" are projections of the vector.
- **P5 — Directed & multi-actor.** State is an edge `source → target`; user↔character today,
  NPC↔NPC ready.
- **P6 — Branch-safe & auditable.** Every change is an event on a ledger; snapshots are captured per
  timeline node and forked on branching.
- **P7 — Consistency first.** The engine may never silently rewrite the character; it conditions,
  it does not override `consistencyRules`.

## 2. Actors & edges

```
Actor        = { id, kind: 'user' | 'character' | 'npc', displayName }
RelationshipEdge (logical id) = hash(sourceActorId, targetActorId, scopeId)
```

- The **primary edge** is `user → character` within a chat scope. This is what conditions the
  character's behavior toward the user.
- The **reverse edge** `character → user` is modeled but **optional** in v0.2 (reserved for NPC
  autonomy; may be left uninstantiated).
- `scopeId` = the timeline/chat id, so a branch has its own edge state (see §8).
- Edges are **directional**: `A→B` (how A feels about B) is independent of `B→A`.

## 3. The relationship vector

Nine dimensions, each `∈ [0,1]`. Each has a **baseline** (rest value), a **stickiness** (how much it
resists change / decays back), and a **polarity** note.

| Dimension | Meaning | Baseline | Profile |
|---|---|---|---|
| `trust` | Belief the other is safe/reliable/honest | 0.15 | Sticky; slow decay toward baseline when neglected; hard to rebuild after betrayal (asymmetric — see §5.3) |
| `affection` | Warmth, fondness, care | 0.10 | Sticky; mild decay |
| `respect` | Regard for character/competence/principles | 0.30 | Sticky; damaged sharply by humiliation |
| `attachment` | Emotional importance / bond weight | 0.00 | **Very sticky**; rises with shared significant events; falls only slowly (loss is felt) |
| `dependence` | Reliance / need for the other | 0.00 | Sticky; can become unhealthy at high values with low trust |
| `familiarity` | Shared history / how well-known | 0.00 | **Monotonic non-decreasing**; the one dimension conversation reliably grows — slowly and capped |
| `romanticInterest` | Romantic / sexual pull | 0.00 | Sticky; **gated** by character permissions (see §3.1) |
| `conflict` | Active friction, resentment | 0.00 | **Volatile**; decays toward 0 each turn; spikes on negative events |
| `fear` | Intimidation, threat, unsafety | 0.00 | Semi-volatile; decays *slowly*; spikes on threat/aggression |

```
RelationshipVector = {
  trust, affection, respect, attachment, dependence,
  familiarity, romanticInterest, conflict, fear   // each number ∈ [0,1]
}
```

### 3.1 Gating & character permissions

A character card may declare relationship policy (additive, defaults preserve v0.1 behavior):

```
CharacterRelationshipPolicy = {
  allowRomance?: boolean            // default true; if false, romanticInterest is clamped to 0
  romanceGateTrust?: number         // romanticInterest cannot exceed this until trust ≥ threshold
  startingVector?: Partial<RelationshipVector>  // e.g. a "childhood friend" starts familiar
  dimensionCaps?: Partial<Record<Dimension, [min, max]>>  // e.g. an aloof persona caps dependence
  decayProfileOverride?: Partial<Record<Dimension, DecayProfile>>
}
```

Gating is applied **after** event math, as a clamp, so a policy can never be bypassed by an event.

## 4. Events — the unit of change

```
RelationshipEventType  = string        // from the taxonomy in §4.1 (extensible)
EventWeight            = 'minor' | 'moderate' | 'major' | 'pivotal'
EventSource           = 'user-pinned' | 'auto-detected' | 'memory-derived' | 'system'

RelationshipEvent = {
  id, edgeId, scopeId (timelineId),
  atMessageId?,           // anchor in the transcript, if any
  timestamp,
  type: RelationshipEventType,
  weight: EventWeight,
  deltas: Partial<Record<Dimension, number>>,  // signed *intended* change, pre-weight
  source: EventSource,
  confidence?: number,    // 0..1 for auto-detected; scales effect (see §5.2)
  note?: string           // human-readable ("apologized after the argument")
}
```

**Weight scalars** (multiply the intended deltas):
`minor = 0.25`, `moderate = 0.5`, `major = 1.0`, `pivotal = 2.0`.

### 4.1 Starter event taxonomy (extensible)

Each event type ships a **default delta template**; `deltas` on an instance may override. Signs are
illustrative; magnitudes are the *pre-weight* intended change.

| Type | trust | affection | respect | attach | depend | romantic | conflict | fear |
|---|---|---|---|---|---|---|---|---|
| `compliment` | | +.05 | +.03 | | | | | |
| `gift` | +.03 | +.08 | | +.03 | | | | |
| `comfort_given` | +.06 | +.08 | | +.05 | +.03 | | −.05 | |
| `secret_shared` | +.10 | +.04 | | +.08 | | | | |
| `vulnerability_shown` | +.08 | +.06 | +.03 | +.06 | | | | |
| `promise_kept` | +.12 | | +.06 | | | | −.05 | |
| `confession_love` | +.05 | +.12 | | +.10 | | +.20 | | |
| `physical_intimacy` | +.04 | +.08 | | +.08 | +.04 | +.15 | | |
| `rescue` / `sacrifice` | +.15 | +.10 | +.12 | +.15 | +.08 | | −.05 | −.05 |
| `principled_stand` | +.05 | | +.15 | | | | | |
| `reunion` | +.02 | +.06 | | +.08 | +.05 | | −.03 | |
| `apology` (repair) | +.05 | +.03 | +.03 | | | | −.20 | −.05 |
| `forgiveness` (repair) | +.06 | +.05 | | +.03 | | | −.15 | −.03 |
| `insult` | −.04 | −.06 | −.08 | | | | +.15 | |
| `rejection` | −.03 | −.08 | | −.03 | | −.10 | +.10 | |
| `boundary_violation` | −.10 | −.05 | −.08 | | | | +.18 | +.08 |
| `lie_detected` | −.18 | −.04 | −.06 | | | | +.12 | +.03 |
| `betrayal` | −.30 | −.15 | −.10 | −.05 | | | +.25 | +.08 |
| `threat` | −.08 | −.05 | | | | | +.15 | +.30 |
| `aggression` / `violence` | −.10 | −.08 | −.05 | | | | +.20 | +.35 |
| `humiliation` | −.06 | −.05 | −.25 | | | | +.15 | +.05 |

`familiarity` is not in the table because it is driven by exposure/revelation (§5.4), not by
discrete emotional events — though any event with `atMessageId` also contributes a small familiarity
increment.

## 5. Update algorithm (pure)

Two update paths per turn: the **ambient update** (bounded, from conversation) and **event
application** (from zero or more detected/injected events). Both are pure functions of
`(vector, inputs)`.

### 5.1 Per-turn ambient update — *limited by design (P2)*

Given the turn's `EmotionSignals { toneScore, conflictLevel }` (from the existing
`signal-extractor`) and an `ambientBudget`:

```
applyAmbient(vector, signals):
  familiarity += FAMILIARITY_STEP                      // e.g. 0.01, monotonic, capped at 1
  conflict     = decayToward(conflict, 0, CONFLICT_DECAY)   // e.g. 0.25/turn
  fear         = decayToward(fear,     0, FEAR_DECAY)       // e.g. 0.05/turn (slow)
  # tiny, capped nudges — NOT a driver:
  affection   += clampMagnitude((toneScore - 0.5) * AMBIENT_GAIN, ambientBudget)   // AMBIENT_GAIN ≈ 0.02
  conflict    += clampMagnitude(conflictLevel * AMBIENT_GAIN, ambientBudget)
  # sticky dimensions (trust/respect/attachment/dependence/romantic) are UNTOUCHED by ambient.
```

Invariant **A1 (ambient cap):** the total absolute ambient change to any sticky dimension across a
turn is `0`; the only per-turn movers are `familiarity` (up), `conflict`/`fear` (decay), and a
sub-`AMBIENT_GAIN` nudge to `affection`/`conflict`. A 100-turn neutral chat therefore cannot move
trust/respect/attachment/romantic at all — only familiarity accrues (and saturates).

### 5.2 Event application

For each event, compute the effective delta and apply with diminishing returns near bounds:

```
applyEvent(vector, event):
  scale = weightScalar(event.weight) * (event.confidence ?? 1)
  for (dim, intended) in effectiveDeltas(event):    // template ⊕ overrides
    delta = intended * scale * resistance(vector[dim], intended, dim)
    vector[dim] = clamp01(vector[dim] + delta)
  vector = applyGates(vector, policy)               // §3.1 clamps
  vector = applyCouplings(vector)                    // §5.3
```

`resistance(value, intended, dim)`: **diminishing returns** — raising an already-high value is
harder; lowering an already-low value is harder. E.g. `resistance = intended>0 ? (1 - value) :
value`, optionally raised to a per-dimension exponent (attachment resists reduction strongly).

Invariant **E1 (bounds):** every dimension stays in `[0,1]` after any sequence of events.
Invariant **E2 (determinism):** `applyEvent` is a pure function; identical `(vector, event)` →
identical result.

### 5.3 Cross-dimension couplings (asymmetries)

Applied after raw deltas so relationships behave realistically:

- **Betrayal asymmetry:** negative `trust` deltas apply at full magnitude; positive `trust` deltas
  are damped while `conflict` or `fear` is high (`trustRebuildFactor = 1 − max(conflict, fear)`).
  Trust is *slow to rebuild, fast to lose.*
- **Fear suppresses affection expression** but not stored affection: projection (§7) reads
  affection *through* a fear mask; the stored value is preserved so it can resurface after fear
  decays.
- **Dependence without trust → instability:** high `dependence` + low `trust` raises the
  `Obsessive/Unhealthy` overlay (state machine), not a numeric change.
- **Respect gates romantic depth:** `romanticInterest` above `0.5` decays if `respect < 0.25`.

Couplings are declarative constants documented here and unit-tested (TEST_PLAN §4).

### 5.4 Familiarity & memory influence

- **Exposure:** each turn adds `FAMILIARITY_STEP`; each event with an anchor adds a small increment;
  first-time revelations (name, backstory facts stored as memories) add a one-off bump.
- **Memory-derived events (P: Memory→Relationship):** when the `MemoryEngine` records a memory whose
  `emotionWeight ≥ MEMORY_EVENT_THRESHOLD` (e.g. 0.75) or a pinned/world memory is added, the
  application layer emits a `memory-derived` `RelationshipEvent` (low/moderate weight) so
  emotionally significant memories nudge the relationship — closing the "memory influences
  relationship" requirement without the pure core touching the memory store.
- **Recall salience:** memories recalled for a turn (already computed in the pipeline) can raise the
  **confidence** of auto-detected events on that turn (e.g. recalling a past betrayal makes a new
  slight land harder). This is an application-layer input to `applyEvent`, not core state.

## 6. Event detection (application layer, not core)

Detection produces `RelationshipEvent`s from three sources; the pure engine only consumes them:

1. **User-pinned (authoritative):** the user marks a moment (extends today's timeline milestone UI)
   and optionally picks a type/weight. `source='user-pinned'`, `confidence=1`.
2. **Auto-detected (advisory):** a lightweight, deterministic detector over the turn text + signals
   (keyword/intent lists like the existing `signal-extractor`, extended with event patterns:
   apology, threat, confession, gift, insult…). Emits low-to-moderate weight events with
   `confidence < 1`. **No LLM required**; an optional LLM classifier may raise confidence later
   behind the provider port, but is out of scope for v0.2 and never blocks the turn.
3. **Memory-derived (§5.4).**

Detection is **reversible and low-weight by default** so a misdetection cannot wreck a relationship;
pivotal changes should come from user-pinned or explicitly confirmed events.

## 7. Projections — how relationship influences generation

The engine exposes pure **projection** functions consumed at the existing persona-fusion seam
(`derivePersonaState`). None of these mutate state.

### 7.1 Stage (read-model)

```
netBond = clamp01(
  0.30*trust + 0.20*affection + 0.15*attachment +
  0.15*respect + 0.10*familiarity + 0.10*romanticInterest
  − 0.5*(0.6*conflict + 0.7*fear)
)
```

Mapped to bands **with hysteresis** and overlays (full rules in STATE_MACHINE):
`Stranger < 0.20 ≤ Acquaintance < 0.45 ≤ Companion < 0.70 ≤ Intimate < 0.88 ≤ Devoted`.
If `romanticInterest ≥ 0.5`, labels shift to romantic variants (Lover, Beloved). Overlays:
`Rupture` (conflict high), `Fearful` (fear high), `Obsessive` (dependence high + trust low).

### 7.2 Attachment style (read-model)

Projected from `(trust, attachment, conflict, fear, dependence)` →
`secure | anxious | possessive | avoidant | fearful` (decision table in STATE_MACHINE §4). This
generalizes the existing `attachmentStyleOf`.

### 7.3 Prompt influence

`projectToDirectives(vector)` returns a small, bounded set of natural-language directives folded
into the per-turn context (never the trimmable optional block — relationship conditioning rides with
the persona block). It maps dimension bands to phrasing guidance (e.g. high trust → "speaks
candidly, lets guard down"; high fear → "wary, measures words, avoids provoking"). Output is
**capped in length** to respect the `TokenBudget` (relationship directives are part of the
never-trimmed persona region but must stay compact).

### 7.4 Greeting influence

`selectGreeting(card, vector)` chooses among the character's `alternateGreetings` (or generates a
tone hint for a dynamic opener) using stage + dominant dimensions — a devoted, high-affection edge
opens warmly; a high-conflict edge opens coldly; a fearful edge opens guarded. Replaces v0.1's
random `pickGreeting`.

### 7.5 Narration influence

A `narrationTone` hint (warmth, tension, distance) derived from the vector conditions *how scenes are
narrated* (not just dialogue), injected as a compact directive.

### 7.6 Emotional-response influence (Relationship → Emotion)

The relationship provides a **baseline bias** to the `EmotionEngine`: e.g. a high-attachment edge
raises the affect baseline the mood decays toward, so the character is warmer *by default* with
someone they love. This is a one-way read (relationship → emotion baseline); the per-turn affect
still moves with signals. Closes the loop without coupling the two pure modules (the bias is passed
in, not imported).

## 8. Snapshots, timelines & branching

```
RelationshipSnapshot = {
  id, edgeId, scopeId (timelineId), atMessageId?, timestamp,
  vector: RelationshipVector,
  stage: string, attachmentStyle: string,          // cached projections for display/audit
  recentEventIds: string[],                          // tail of the ledger at this point
  schemaVersion: number
}
```

- A snapshot is captured **when a relationship-changing event is applied** and at **timeline
  milestones**, giving a replayable history aligned with the story timeline.
- **Branching:** forking a chat (existing `forkChat`) copies the current snapshot and the event
  ledger up to the fork point into the new `scopeId`; subsequent events diverge. Two branches from
  the same point evolve independently — required by "relationship must support branching chats."
- **Rewind/replay:** because state = `seed ⊕ ordered events`, any point is reconstructable by
  replaying the ledger to a chosen `atMessageId` (supports future "edit history" / regenerate).

## 9. Configuration constants (tunable, documented)

All magic numbers live in one documented config object (values above are defaults):
`AFFINITY→` removed; `FAMILIARITY_STEP`, `CONFLICT_DECAY`, `FEAR_DECAY`, `AMBIENT_GAIN`,
`ambientBudget`, weight scalars, projection weights, `MEMORY_EVENT_THRESHOLD`, hysteresis margins,
per-dimension baselines/decay/resistance exponents. Tuning changes behavior only through this object
(TEST_PLAN pins the defaults).

## 10. Invariants (must always hold)

- **A1** ambient cap (sticky dims unmoved by conversation).
- **E1** bounds `[0,1]`; **E2** determinism/purity.
- **F1** `familiarity` never decreases.
- **G1** gates/policy clamps are always the last transform (uncircumventable).
- **S1** every state change corresponds to ≥1 ledger event (auditability).
- **B1** branching yields independent edges sharing history only up to the fork point.
- **C1** projections are pure and never mutate the vector.
- **P7** projections condition but never contradict `consistencyRules` / system-prompt override.
