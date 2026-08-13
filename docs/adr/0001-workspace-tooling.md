# ADR 0001 — Workspace tooling: pnpm workspaces, no Turborepo

**Status:** accepted · 2026-08-13
**Supersedes:** the original 2026-08-13 version of this ADR, which chose npm workspaces. Reversed the same day, before any code or lockfile existed.

## Context

The project is four packages (`domain`, `data`, `persistence`, `app`) with a strict one-directional dependency graph: `app → persistence → data → domain`. Two tooling questions, and they turn out to be independent.

**Package manager.** The binding constraint is that `domain` must have _no dependencies at all_ (ground rule 1) and the direction must never be violated. Under npm's flat, hoisted `node_modules`, any package can import anything that happens to be installed anywhere in the tree, and nothing complains — enforcement rests entirely on a lint rule. pnpm's strict layout links only declared dependencies into a package's `node_modules`, so an undeclared import fails at resolution.

**Task runner.** Turborepo offers content-hash caching and a dependency-ordered task graph. Its payoff scales with package count × task duration. Three of the four packages here are pure TypeScript consumed from source with no build step, and the suite runs in well under a second.

## Decision

**pnpm workspaces. No Turborepo.**

- `pnpm-workspace.yaml` over `packages/*`; workspace deps declared as `workspace:*`.
- pnpm pinned in `mise.toml` and mirrored in `packageManager`.
- Boundary enforcement is two layers: pnpm's resolution, plus ESLint `no-restricted-imports` against `@fm/*` specifiers.

## Consequences

- **Two independent enforcement layers, which fail differently and usefully.** pnpm gives a hard resolution error; ESLint gives a readable message naming the rule and pointing at this ADR. Neither is sufficient alone: pnpm cannot explain _why_, and ESLint can be disabled with a comment.
- The ESLint half only counts if it runs in CI, not just locally. `.github/workflows/ci.yml` runs `pnpm lint`, and `tests/boundaries.test.ts` asserts the rule still fires — a boundary rule that silently stops matching is worse than none, because the invariant looks guarded while it isn't.
- **Boundary matching is on specifiers, not resolved paths.** `eslint-plugin-import-x`'s `no-restricted-paths` matches resolved file paths, and under pnpm a workspace import resolves through a symlink — whether a zone matches then depends on realpath behaviour in the resolver. Our `@fm/*` naming convention makes specifier matching exact and resolver-free. See `docs/stack.md`.
- Adding Turborepo later is a `turbo.json` plus per-package task config — additive, not a migration. **Revisit when** `pnpm test -- --run` is slow enough to interrupt the edit-test loop, or when a real build step appears between packages.
