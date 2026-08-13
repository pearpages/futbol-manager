# ADR 0005 — Persistence: IndexedDB + JSON export, versioned from save one

**Status:** accepted · 2026-08-13 (records a decision already made in the roadmap)

## Context

Ground rule 3: "every save carries `schemaVersion` and a migration chain, from the very first save file. Non-negotiable." The game is a web app with long-lived careers — a player may run a save across months of real time and many shipped versions.

Save state is large-ish (thousands of players by M7) and structured. `localStorage` is a 5MB string store and is synchronous; it does not fit.

## Decision

- **IndexedDB** as the primary store, wrapped behind the `persistence` package so `domain` never sees it.
- **JSON export/import** as a first-class second path — backup, bug reports, moving between browsers.
- Every save carries **`schemaVersion`** from the first one ever written.
- Every schema change ships a migration function plus a **round-trip test against a stored fixture save from the previous version**. One fixture save per shipped version is committed to the repo.

## Consequences

- The save must include everything the simulation needs to resume identically: entity state, `Season.currentDate` (the day clock is state, not wall time), and the PRNG state from [ADR 0002](./0002-prng.md). A save that omits the PRNG state silently breaks determinism on reload.
- Fixture saves accumulate in the repo, one per shipped version. This is deliberate weight — it is the only thing that proves the migration chain still works end to end rather than one hop at a time.
- Migrations are forward-only. There is no downgrade path, and shipping a version means committing to migrating away from it.
- Because `persistence` sits between `app` and `data` in the dependency direction, nothing in `domain` may reference IndexedDB, `structuredClone` semantics, or storage quotas. Serialisation shape is `persistence`'s problem.
