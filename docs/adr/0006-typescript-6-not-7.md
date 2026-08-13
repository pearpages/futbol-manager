# ADR 0006 — TypeScript pinned to 6.0.3, not 7.x

**Status:** accepted · 2026-08-13

## Context

TypeScript 7.0.2 is the current `latest` — the native compiler, and a large build-speed win.

**typescript-eslint 8.67.0 declares `typescript: >=4.8.4 <6.1.0`.** That cap holds on the `canary` tag (`8.67.1-alpha.4`) too, so it is not a lag of days. typescript-eslint imports the `typescript` package directly for parsing and type information; it cannot simply widen the range.

Taking TypeScript 7 therefore means dropping typescript-eslint, and with it every `@typescript-eslint/*` rule. That matters more here than in a typical app: `docs/adr/0001-workspace-tooling.md` makes ESLint one of the two boundary-enforcement layers, and the ground rules are enforced by lint rules scoped to `packages/domain`.

Latest 6.x is **6.0.3**.

## Decision

Pin **TypeScript 6.0.3** across the workspace. Do not upgrade to 7.x until typescript-eslint supports it.

## Consequences

- We forgo the native compiler's speed. At four small packages this is currently unmeasurable; `pnpm typecheck` returns immediately.
- The pin will look like neglect within a few months — a plain "typescript is 3 versions behind" that invites a well-meaning bump. This ADR is the reason it exists; `docs/stack.md` repeats it in the upgrade policy. **Do not bump TypeScript without checking typescript-eslint's peer range first.**
- **Revisit when** typescript-eslint publishes a release whose `peerDependencies.typescript` admits `>=7`. Check with `npm view typescript-eslint peerDependencies`. At that point the upgrade should be a two-line change plus a green test run.
- If the pin ever has to break before then, the fallback is native `tsc --noEmit` for types plus ESLint core rules only — accepting that the `domain` restrictions still work (they are all core rules: `no-restricted-imports`, `no-restricted-properties`, `no-restricted-syntax`) while typed rules disappear. Worth knowing the invariants survive that trade.
