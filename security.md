# Security

The security surface of Futbol Manager and the rules that protect it. General rules are in
[principles.md](principles.md); how the pieces fit in [architecture.md](architecture.md).
Update this file whenever the surface changes (new input, endpoint, secret, dependency,
permission).

## Reporting a vulnerability

Report it privately through a GitHub security advisory on
[pearpages/futbol-manager](https://github.com/pearpages/futbol-manager/security/advisories/new)
(private vulnerability reporting is enabled on the repository). Never open a public issue for
an unfixed vulnerability.

## Surface

Small by construction. This is a static single-page app on GitHub Pages:

- **No backend, no accounts, no network calls.** The app does not call `fetch` or open sockets,
  and it loads no third-party scripts, fonts or analytics. The only thing it requests is its own
  static assets.
- **Data stays on the player's device.** Saves live in IndexedDB (`saves` and `slots` stores).
  The language and the last-used slot live in `localStorage`. Nothing is sent anywhere.
- **No HTML from data.** There is no `dangerouslySetInnerHTML` or `innerHTML`. Everything
  rendered goes through React's escaping, including player and club names.
- **Untrusted input: save import.** `importSave` exists in `@fm/persistence` but is not
  wired to the UI yet. Once it is, an imported JSON file is untrusted. It must go through the
  migration chain, which already refuses a save from a future version, and must be validated
  before it reaches the reducer. A malformed save should fail closed, not crash the app (there
  is no `ErrorBoundary`).
- **CI/CD.** The workflow declares `contents: read` at the top, so the `check` job, which
  runs pull-request code, holds a read-only token whatever the repository default says. The
  deploy job alone adds `pages: write` and `id-token: write`, only for a published release
  (or a manual run from its `v*` tag), and only after `check` passes (ADR 0020). The
  `github-pages` environment accepts `main` and `v*` tags and nothing else.
- **`main` is protected** by the "Protect main" ruleset: no force-push, no deletion, and the
  `check` status is required. Repository admins may bypass it, which keeps a direct push
  possible, but a push to `main` no longer deploys anything.
- **The dev server.** `pnpm dev` binds to localhost. `pnpm dev:lan` exposes it to the local
  network, which is opt-in, for trying the game on a phone.

## Secrets

- None. The app and CI need no API keys. Deployment authenticates with GitHub's OIDC token.
- `*.local` is gitignored. If a secret is ever introduced, it goes in GitHub Actions secrets
  and an example file lists names only.
- Generated art (ADR 0012) is produced offline. No image-generation key is in the repo or in CI.

## Dependencies

- Minimal runtime: `react`, `react-dom`, `zustand`, `idb`. `@fm/domain` has no dependencies at all.
- Storybook (ADR 0017) is a dev-only tool in `packages/app`, never built into the game or
  deployed. Install scripts are refused by default; esbuild's is explicitly refused in
  `pnpm-workspace.yaml`, because its binary arrives as a platform package without one.
- `@fm/design-system` adds only dev dependencies (Vite's library build, `vite-plugin-dts`,
  `@microsoft/api-extractor`). Its `dist/bundle.js` is for the Claude Design System artifact
  and is never loaded by the game. A build step fails it if it imports, requires or fetches
  anything, or contains `</script` (ADR 0016).
- Every version is an exact pin, decided only in [docs/stack.md](docs/stack.md). The lockfile
  is committed and CI installs with `--frozen-lockfile`.
- pnpm's strict `node_modules` blocks undeclared imports.
- No automated update or audit tooling is configured (no Dependabot or Renovate). Bumps are
  deliberate commits.

## Known risks

- **GitHub Actions are pinned by tag (`@v4`, `@v2`), not by commit SHA.** A compromised
  upstream tag would run in CI with the deploy permissions above. This is accepted for now
  given the small blast radius (a static site), and tracked in tasks.md.
- **No dependency audit in CI.** This is accepted because the runtime set is four packages,
  and tracked in tasks.md.
- **Intellectual property, not security, but the same kind of exposure:** the shipped rosters
  carry real squad shapes with altered names. The risk is accepted and bounded in
  [ADR 0010](docs/adr/0010-real-squad-shapes.md) and [ADR 0011](docs/adr/0011-a-market-abroad.md).
