# NamoChat — Context Intelligence Layer: Architecture Review

Review-only. Assesses how the per-turn "Context Intelligence Layer" composes a prompt from six
subsystems and their orchestration in `stores/chat-pipeline.ts`:

- **Persona Lock** — `core/prompt/prompt-builder.ts#buildPersonaLock` (consistency rules; mandatory).
- **Character Identity** — `core/identity/identity-capsule.ts` (`getSystemContext` once/session,
  `getDistilledContext` per turn).
- **Relationship Engine v0.2** — `core/relationship/*` + `stores/relationship-runtime.ts`
  (feature-flagged; `advanceRelationship`→`toPersonaInputs`).
- **Memory Engine** — `core/memory/*` (`recallSemantic`/`recallLexical`, `evaluateInteraction`).
- **Lore Engine (design)** — current minimal `core/lore/lore-engine.ts#matchLore`; generic design in
  `docs/lore/`.
- **Prompt Composer** — `buildSystemPrompt` + `core/prompt/context-builder.ts#buildTurnContext` +
  `core/prompt/token-budget.ts#TokenBudget`.

Fusion point: **Soul Core** `core/soul/soul-core.ts#derivePersonaState`. **No code changes.**

## 1. Data flow

Two injection seams: a **once-per-session system prompt** and a **per-turn context block**.

```
SYSTEM PROMPT (built per request from static data; identity loaded here)
  = buildSystemPrompt(character):
      preamble | Character desc | Personality | Scenario
      | Identity.getSystemContext()   ← full identity, once
      | Example dialogue (few-shot)   | language

PER-TURN (chat-pipeline.runTurn):
  userText
   → extractSignals  →  {toneScore, conflictLevel}
   → EmotionEngine: updateAffect → applyDecay  →  affect'          (synchronous, in order)
   → RelationshipEngine v1: progress(relationship, affect')        (legacy scalar, always)
   → [flag ON] RelationshipEngine v2: ensure/seed → applyAmbient → projectStage/attachment
   → SoulCore.derivePersonaState(identity, affect', relationship, engine) → PersonaState
   → [flag ON] effectivePersona = {…PersonaState, …v2 personaOverride(stage/attachment/narration)}
   → MemoryEngine.recall(query)  →  memories[]   (semantic if embeddable, else lexical)
   → LoreEngine.matchLore(character.lorebook, userText) → lore[]
   → PromptComposer.buildTurnContext({
        MANDATORY: systemPrompt, history, personaLock, personaBlock(distilledIdentity+stage+attachment)
        OPTIONAL (budget-gated, ranked): storyRecap, world lore, triggered lore, memories
     })
   → provider.streamChat(system, context, history) → CognitiveStreamParser → visible text
   → PERSIST (after reply): memory.remember + evaluateInteraction;
        [flag ON] commitRelationship (memory-derived events → vector + ledger)
```

**Key observations.**
- **Identity is split across both seams**: full `getSystemContext()` in the system prompt (once);
  compact `getDistilledContext()` in the per-turn persona block. Correct for token economy.
- **Emotion + relationship are computed before composition** so downstream (and the future Lore
  Engine's relationship gates) can read them. Good ordering for the Lore design.
- **Memory & lore bypass Soul Core** and go straight to the composer — Soul Core fuses only
  *persona* (identity+affect+relationship), not world/knowledge context. This split is defensible but
  under-documented (see §6).
- **Effects are post-reply** (memory save, relationship commit), so a failed turn mutates nothing
  (consistent discipline).

## 2. Priority conflicts

Project priority order: **1 Character Consistency · 2 Memory · 3 Roleplay · 4 UI · 5 Perf ·
6 Clean.** Conflicts observed between subsystems and how they currently resolve:

| Conflict | Current resolution | Assessment |
|---|---|---|
| Persona Lock vs Relationship directive | Lock is a **separate mandatory** block; relationship rides `personaBlock.stageDirective` (also mandatory) — both survive; lock is authoritative text | OK, but **both are mandatory** → the "never-trimmed" region can grow (see §3). Lock should also out-rank relationship *in wording*, not just position (§4/§6). |
| Relationship v2 override vs Soul Core output | Pipeline **spreads** `v2 personaOverride` over `derivePersonaState`'s stage/attachment fields | **Smell**: two sources compute the same fields; v2 wins by object-spread order, not by design. Single-source it (§6). |
| Distilled Identity vs Relationship mood | Both concatenated in `personaBlock` | Fine; distinct concerns (who vs how-they-feel-now). |
| Memory vs Lore (optional tier) | Both are optional candidates; ranked recap→world→lore→memory in `buildTurnContext` | Lore currently ranked **above** memory; under tight budget memory can be starved. Needs a **shared, fair split** (§3, and the Lore design's shared-budget note). |
| Affect (mood) vs Relationship (stage) vs Memory (facts) | Independently injected; no reconciliation | Possible **contradiction** (warm mood + Rupture overlay + a hostile memory). Model must reconcile; acceptable but a coherence risk (§7). |
| Emotion baseline vs Relationship | Not yet connected | Future coupling risk of feedback loop (§5). |

**Verdict:** consistency is protected structurally (lock + persona mandatory, trimmed last), but there
are **two latent issues**: (a) the mandatory region has no size ceiling, and (b) relationship state is
computed on **two paths** (Soul Core + v2 override).

## 3. Token budget strategy

Current model (`TokenBudget.selectWithinBudget(mandatory, candidates)`):
- **Mandatory (never trimmed):** system prompt, full history texts, persona lock, persona block
  (distilled identity + relationship stage/attachment/narration/notes).
- **Optional (trimmed first, in rank order):** story recap → world lore → triggered lore → memories.
- Reserves `reservedOutputTokens`; a fixed `CONTEXT_WINDOW_TOKENS` (8000) heuristic (`length/4`).

**Strengths.** Character Consistency is budget-immune by construction; optional context degrades
gracefully; the estimator is cheap and model-agnostic.

**Gaps / risks.**
1. **Unbounded mandatory region.** History (`HISTORY_TURNS=20`) + relationship narration/notes +
   distilled identity are all mandatory. On long turns this can crowd out *all* optional context, or
   exceed the window before optional is even considered. There is no per-section cap or history
   summarization.
2. **Lore ranked above memory.** With the generic Lore Engine (esp. imported packs with `constant`
   entries), lore can starve memory — a Memory-priority (#2) inversion.
3. **Fixed window, heuristic tokens.** `length/4` and a static 8000 don't adapt to the selected
   model's real context/tokenizer; under-/over-estimates are possible.
4. **Relationship directives are mandatory but attacker/scale-sensitive.** They're small today, but
   appending `narration` + `dimensionNotes` to `stageDirective` grows the never-trimmed region.

**Recommendations.**
- Introduce a **shared optional-budget split** (memory : lore) with per-source caps, and rank memory
  at least on par with lore (honor Memory priority #2).
- Add **soft caps** to the mandatory region: cap relationship-directive length; make history
  **summarize/compact** beyond N turns rather than hard-including 20 raw turns.
- Make the window/estimator **model-aware** (per-provider context size + a better token estimate)
  when providers expose it.
- Keep the persona lock + a compact persona restatement as the *only* unconditionally-mandatory
  relationship text.

## 4. Security boundaries

| Boundary | Trusted | Untrusted | Current control |
|---|---|---|---|
| System prompt / persona lock / identity | ✅ | | Authored; mandatory; must always win |
| User input | operator | can attempt jailbreak | Passed as `history`; not privileged over system |
| **Memory content** | derived | can be poisoned | **Guarded**: error text & internal directives never saved; role-typed; re-run turns don't duplicate |
| **Lore / Scenario Packs** | character/world (user) | **imported = untrusted** | Design: injection-scan, quarantine, data-only envelope, drop executable fields (see `docs/scenario-packs/SCENARIO_PACK_SECURITY_REVIEW.md`) |
| Model output | | steerable | Parsed (`CognitiveStreamParser`); not fed back as instructions |
| Pure core vs app layer | ✅ pure (no I/O) | | Engines never touch storage/LLM; app orchestrates |

**Findings.**
- **Persona-lock supremacy is positional, not semantic.** Nothing in the lock currently says
  "reference lore/memory cannot override your character." Recommend a standing clause + re-assertion
  **after** the optional block so the character has the last word (cross-refs the pack review §6).
- **Untrusted lore can forge Relationship events** *iff* a future lore→relationship write hook is
  enabled — must be **prohibited for untrusted sources** (pack review §7). Today the Relationship
  Engine is pure and only mutated via the app-layer ledger, which is correct.
- **Memory poisoning surface** is well-contained today (error text excluded) but will widen when
  lore→memory promotion lands; promoted memories must carry provenance and be purgeable.
- **Injection reaches the model through the optional tier**, which is *below* mandatory — good, but
  positioning ≠ obedience (defense-in-depth, not a guarantee).

## 5. Future Emotion Engine integration

Today the **Emotion Engine already runs** (affect vector → `derivePersonaState.moodLine`). What's
**not** wired is the designed **Relationship → Emotion baseline bias**
(`relationship-projection.ts#relationshipBaselineBias`).

**Recommended integration (one-way, acyclic).**
- Compute the relationship vector first (already the case), derive `relationshipBaselineBias`, and
  pass it as the **baseline** `updateAffect`/`applyDecay` relax toward — so a high-attachment edge is
  warm *by default*. Emotion stays pure; the bias is **passed in**, not imported.
- Keep the dependency **one-directional**: Relationship → Emotion baseline → mood vocabulary in the
  prompt. Emotion must **not** feed back into the relationship vector in the same turn.

**Risks to avoid.**
- **Feedback loop / double-counting.** Affect already influences relationship v1 progression; if
  Emotion also biases from relationship, and relationship from emotion, you get compounding drift.
  Enforce: relationship reads *this turn's* signals; emotion reads the *resulting* relationship
  baseline; no back-edge. Document the DAG.
- **Two mood sources.** `moodLine` (affect) and relationship overlays (Rupture/Fearful) both color
  tone; reconcile precedence (overlay should dominate narration when active).
- **Order sensitivity.** Bias must be computed after the relationship advance and before
  `derivePersonaState`, or Soul Core won't see it.

## 6. Soul Core integration

`derivePersonaState(identity, affect, relationship, relationshipEngine)` is meant to be the **single
fusion point** for persona. Two integration problems today:

1. **v2 relationship bypasses Soul Core.** With the flag ON, the pipeline computes `derivePersonaState`
   (v1 scalar) **and then overrides** its stage/attachment fields with v2 projections via object
   spread. So persona fusion happens in **two places**, and Soul Core never sees the nine-dim vector.
   → **Recommend:** make Soul Core v2-aware — pass the `RelationshipVector`/`StageProjection` into
   `derivePersonaState` (or a v2 sibling) so fusion stays single-source and the override disappears.
   This also lets Soul Core carry `narrationTone`/`dimensionNotes` as first-class `PersonaState`
   fields instead of string-appending them to `stageDirective`.
2. **Scope ambiguity.** Soul Core fuses identity+affect+relationship; memory+lore are composed
   separately by `buildTurnContext`. That's a reasonable split (persona vs knowledge), but it's
   **implicit**. → **Recommend:** document Soul Core = "who the character is *right now*" and the
   Prompt Composer = "everything the character *knows/recalls* this turn," with the persona lock
   spanning both as the invariant.

When Emotion baseline bias (§5) lands, Soul Core is the natural place to consume it, reinforcing it as
the single persona-fusion seam.

## 7. Failure modes

| Failure | Current behavior | Gap / risk | Recommendation |
|---|---|---|---|
| Embedding call fails | `safeEmbed` swallows → lexical recall | none significant | keep; add metric |
| Provider request fails/aborts | error text shown but **not** saved as memory; **no** relationship commit | good | keep; ensure v2 commit is also skipped on error (it is: `relationshipTurn && !hasError`) |
| Storage (localStorage/IndexedDB) fails | guarded degrade-to-memory | session-only persistence silently | surface a subtle "not saved" indicator |
| Flag ON/OFF divergence | v1 scalar always runs; v2 additive | **dual state** can drift (v1 `stageIndex` vs v2 vector) | on promotion, retire v1 progression to avoid two truths |
| Migration seeding | legacy→vector on first v2 turn; tested "no downgrade" | edge personas (custom stages) may mis-seed | validate seeds per character policy |
| Mandatory region overflow | no cap; optional starved first, but mandatory can exceed window | **hard failure**: prompt exceeds model limit | cap history/relationship text; summarize (see §3) |
| Lore/pack injection | design: scan+quarantine+envelope | scanner bypass | normalize + post-render scan (pack review §1) |
| Contradictory context | mood vs overlay vs memory vs lore all injected | incoherent replies | precedence rules: overlay > mood; dedupe memory↔lore |
| Cognitive stream truncated | parser tolerates absent/partial block | none | keep |
| Async ordering | emotion/relationship synchronous; effects deferred | a fast second send mid-stream | `activeAbort` guards streaming; verify per-chat turn locking |
| Empty identity | `emptyIdentity` fallback | bland persona, no lock | acceptable; encourage identity authoring in UI |

## 8. Coupling & single-source-of-truth map

| Concern | Should own it | Today |
|---|---|---|
| "Who the character is" | Identity + Persona Lock | ✅ (identity split across two seams; lock separate) |
| "How they feel now" | Emotion (affect) | ✅ computed; overlays add relationship color |
| "How they relate to the user" | Relationship v0.2 vector | ⚠️ **two paths** (Soul Core v1 + v2 override) — unify |
| "What they know/recall" | Memory + Lore | ✅ separate from persona; ⚠️ shared budget unfair to memory |
| "Assemble the prompt" | Prompt Composer + TokenBudget | ✅ mandatory/optional split; ⚠️ no mandatory ceiling |
| "Fuse persona" | Soul Core | ⚠️ bypassed by v2 override; not v2-aware |

## 9. Top recommendations (priority order)

1. **Single-source relationship fusion:** make Soul Core v2-aware; remove the pipeline's object-spread
   override; promote `narrationTone`/`dimensionNotes` to `PersonaState` fields (§6, §2).
2. **Persona-lock semantic supremacy:** add "reference lore/memory cannot override your character"
   clause + re-assert a compact persona after the optional block (§4, §6).
3. **Fair, capped budget:** shared memory↔lore split with per-source caps; soft-cap the mandatory
   region; summarize history beyond N turns; model-aware window (§3).
4. **Guard the future couplings:** one-way Relationship→Emotion baseline (no back-edge); forbid
   untrusted lore→relationship writes (§5, §4).
5. **Retire dual relationship state on flag promotion** to avoid v1/v2 drift (§7).
6. **Coherence precedence:** overlay > mood for narration; dedupe memory↔lore before injection (§2, §7).

## 10. Conclusion

The Context Intelligence Layer is **structurally sound**: Character Consistency is protected by a
mandatory, budget-immune persona region; effects are post-reply so failures don't corrupt state;
pure engines keep I/O at the edges; and untrusted knowledge (lore/packs) is designed to stay
subordinate. The **two real architectural debts** are (1) relationship persona-fusion happening on
two paths (Soul Core + v2 override) and (2) an **unbounded mandatory context region** with an
unfair memory↔lore budget. Neither blocks current work, but both should be resolved before the
Relationship v2 flag is promoted and before the Lore/Emotion integrations land. Addressing §9.1–§9.3
would make the layer's single-source-of-truth guarantees explicit rather than emergent. **Review
only; no code changed.**
