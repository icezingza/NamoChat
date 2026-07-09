# NamoChat — Project Status

**As of:** 2026-07-09
**Version:** v0.1.0 (Foundation)
**Canonical repository:** https://github.com/icezingza/NamoChat
**Status:** Published & verified. Phase 4 not started.

## Current state

| Area | Status |
|---|---|
| Codebase | ✅ Extracted, standalone, decoupled from all legacy repos |
| Tests | ✅ 32/32 passing (Vitest), verified from a fresh clone of `main` |
| Build | ✅ Clean `tsc -b` + Vite production build |
| CI | ✅ `.github/workflows/ci.yml` (typecheck → test → build on push/PR to `main`) |
| Docs | ✅ README, ARCHITECTURE, MIGRATION, MIGRATION_REPORT, CLAUDE, TODO, RELEASE_NOTES, NEXT_PHASE |
| `main` branch | ✅ Published to canonical remote |

## Publish checklist (this task)

| # | Objective | Status |
|---|---|---|
| 1 | Push standalone repo to GitHub | ✅ `main` pushed |
| 2 | Push all branches | ✅ only `main` exists |
| 3 | Push tags (`foundation`, `v0.1.0`) | ⛔ **Blocked** — git proxy rejects tag refs (see below) |
| 4 | Verify remote repository state | ✅ `main` @ `60e7b94`, 61 files |
| 5 | Configure GitHub Actions | ✅ CI workflow added |
| 6 | Verify tests after cloning from remote | ✅ fresh clone → 32/32 pass |
| 7 | Create GitHub Release (v0.1.0) | ⛔ **Blocked** — depends on tag; no release-creation API tool available |
| 8 | README states canonical | ✅ |
| 9 | Update doc references to new repo | ✅ |
| 10 | No legacy repos as dev targets | ✅ audited — legacy repos referenced only as read-only migration sources |

## Blocked items — exact failing step & remediation

**Tags (`foundation`, `v0.1.0`) and the v0.1.0 Release.** The automation environment routes git
through a proxy that permits **branch** ref creation/update but rejects **tag** ref pushes:

```
$ git push origin refs/tags/v0.1.0
send-pack: unexpected disconnect while reading sideband packet
fatal: the remote end hung up unexpectedly
```

Branch pushes to the same remote succeed, confirming this is a tag-ref restriction, not a
credential/permission failure. No `create_release` / `create_tag` / `create_ref` API tool is
available in this session either, so the Release cannot be created server-side.

Local history was **not** modified to work around this. The tags exist in the delivered
`NamoChat.bundle`. To finish from a machine with normal git access:

```bash
git clone https://github.com/icezingza/NamoChat.git && cd NamoChat
# tag the published tip of main:
git tag -a foundation -m "NamoChat Foundation extraction point"
git tag -a v0.1.0     -m "NamoChat v0.1.0 — extracted Foundation"
git push origin --tags
# then create the Release from the tag (gh CLI):
gh release create v0.1.0 --title "NamoChat v0.1.0 — Foundation" --notes-file RELEASE_NOTES.md
```

**Cleanup note:** a `probe-branch` ref (identical to `main`) was created while verifying the
proxy's ref policy. The proxy also blocks ref **deletes**, so it could not be removed
automatically — delete it via the GitHub UI (Branches → 🗑) or `git push origin --delete probe-branch`
from a normal git client. It is harmless (same commit as `main`).

## What's next

Phase 4 planning is captured in [NEXT_PHASE.md](NEXT_PHASE.md). **Not started** per instruction.
