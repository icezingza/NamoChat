# Scenario Pack System — Migration / Rollout Plan (design only)

Design-only. How to introduce the Scenario Pack system and convert the uploaded "Sex Positions &
Kinks" SillyTavern lorebook into an **optional, disabled-by-default** pack — without touching core
engines (including the Relationship Engine) and without exposing anything by default. Companions:
`SCENARIO_PACK_ARCHITECTURE.md`, `SCENARIO_PACK_SCHEMA.md`.

## 0. Constraints honored

| Requirement | How the plan meets it |
|---|---|
| Keep core architecture clean | No changes to `core/` engines; packs reach generation only via the existing `matchLore` seam through an adapter. |
| Store as external knowledge/lore data | Packs are user-imported `.json`, persisted in IndexedDB; **not bundled** in the app/repo, not in core files. |
| Generic Scenario Pack system | Schema is format-agnostic; SillyTavern is one importer; native packs and other importers fit the same manifest. |
| Enable/disable | Registry `enabledIds`; **off by default**; plus a `scenarioPacks` feature flag kill-switch. |
| Tags + metadata | Manifest `tags`/`categories`/`rating`/`contentWarnings`. |
| Do not modify Relationship Engine | Zero relationship changes; packs are lore data only. |
| Do not expose by default | Fresh install: flag OFF, zero enabled packs; explicit packs rating-gated in UI. |
| Documentation only (this sprint) | Only these three docs are produced; no source is modified. |

## 1. Converting the uploaded file into a pack

The uploaded `Sex Positions & Kinks.txt` (a SillyTavern World Info array) maps to **one**
`ScenarioPack`:

- **Manifest:** `name: "Sex Positions & Kinks"`, `source: "sillytavern-worldinfo"`,
  `rating: "explicit"`, `contentWarnings: ["nsfw","explicit-sexual"]`,
  `tags: ["positions","oral","anal","kink","aftercare","dirty-talk"]`, `trusted: false`.
- **Entries:** each array element → one `ScenarioPackEntry` via the mapping table
  (SCHEMA §3); `content` sanitized; `activationScript` dropped.
- **Quarantine:** the `debug` entry (`id:9`, "BEGIN OVERRIDE SEQUENCE…") is imported with
  `blocked: true`, `blockReason: "system-override-injection"`, and never injected. It appears in the
  pack's `injectionScanReport` so the user can see it was neutralized.
- The resulting pack is **installed disabled**; nothing changes in generation until the user both
  enables the `scenarioPacks` flag and toggles the pack on.

> The raw explicit file is **not** committed to the repo. It remains user-supplied data imported at
> runtime. (The repo previously had such a file added and then deleted; the pack system formalizes
> keeping it *out* of core and in opt-in local storage.)

## 2. Phased rollout

Each phase is independently shippable; the subsystem stays OFF until Phase E enables the flag.

**Phase A — Schema module (pure, no behavior).**
Add `core/scenario-pack/` *types + validators + sanitizer + injection scanner* only (pure,
unit-testable; no engine wiring). Deliverable: `ScenarioPack`/`ScenarioPackEntry`/manifest types,
`validatePack`, `scanForInjection`, `sanitizeContent`, and `toLoreEntries(pack)` down-projection.
Tests include the `debug`-entry quarantine and the full mapping of the uploaded file.

**Phase B — Import adapter.**
`services/scenario-pack-importer.ts`: `sillytavern` importer → `ScenarioPack` using the mapping
table, running validation + injection scan. Deterministic, offline. No storage yet.

**Phase C — Registry + storage (still inert).**
`services/scenario-pack-repository.ts` (IndexedDB, guarded, degrade-to-memory) + a Zustand registry
slice `installedIds/enabledIds/manifests`. Import/install/remove/enable/disable operations.
**Default enabledIds = [].** Nothing is injected yet.

**Phase D — Lore-seam wiring (flag-gated).**
In the application layer (pipeline), when `scenarioPacks` flag is ON, merge enabled packs'
`toLoreEntries()` with the character `lorebook` before the existing `matchLore` call, and wrap
matched pack lore in the data-only envelope. **Core lore engine unchanged.** Persona lock stays
supreme; pack lore trimmed first under budget. Flag OFF ⇒ byte-for-byte current behavior.

**Phase E — UI + promotion (optional, later).**
`src/features/scenario-packs/`: import/manage screen, per-pack + per-character/chat toggles, rating
gate + content-warning confirmation for `explicit` packs, and the injection-scan report view. Only
here does anything become user-visible; still off until the user opts in.

## 3. Backward compatibility & isolation

- **No core/engine edits** in Phases A–D beyond a flag-gated merge at the existing lore call site;
  the Relationship, Emotion, Memory, Soul, Identity, Prompt/Context engines are untouched.
- Existing chats/characters are unaffected: no pack enabled ⇒ identical prompts/output.
- Packs are namespaced, removable, and exportable independently of chats.
- Branching a chat inherits that chat's pack selection (consistent with relationship snapshot fork).

## 4. Security rollout (mandatory gates)

- Injection scanner (Phase A) must quarantine the `debug` override before any pack can be enabled.
- Phase D must wrap pack lore as **data**, keep it **below** the persona lock, and **trim it first**
  under token budget — verified by tests before the flag can default ON.
- `activationScript`/executable fields are never imported or run (validator rejects them).
- Explicit packs are rating-gated in the UI (Phase E); the subsystem ships flag-OFF.

## 5. Test plan (for the implementation sprint, not now)

- Schema/validators: mapping fidelity on the uploaded file; `probability` clamp; missing-keys +
  `alwaysActive` rules.
- Injection scanner: the `debug` entry is blocked; benign descriptive entries pass; report is
  accurate; determinism.
- Down-projection: `toLoreEntries` excludes `blocked`/`disabled` entries and feeds `matchLore`
  correctly.
- Enable/disable: disabled pack contributes nothing; flag OFF ⇒ no behavior change (regression
  guard).
- Budget precedence: under a tight `TokenBudget`, persona/consistency survive and pack lore is
  trimmed first.
- Storage: IndexedDB round-trip, guarded degrade-to-memory, clean removal.

## 6. Out of scope

Implementation (all phases), a `{random:...}` renderer, per-tag character opt-in policy, remote pack
catalogs/marketplace (explicitly excluded — NamoChat has no marketplace), and any Relationship/
Emotion engine work. **Stop after design.**
