# Stack

**This is the only place a version number is decided.** `package.json` files mirror it; when they disagree, this document is wrong or they are — reconcile, don't fork.

Every version below was verified against the npm registry on 2026-08-13. Exact pins, no ranges: a management sim is a long-lived save format, and a silent minor bump that changes a rounding behaviour is a save-compatibility bug wearing a disguise.

---

## Runtime and package manager

|      | Version     | Why                                                                                                                                                                                                                                                               |
| ---- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node | **24.16.0** | Active LTS, supported into 2028. Satisfies Vite 8's `^20.19.0 \|\| >=22.12.0`.                                                                                                                                                                                    |
| pnpm | **11.15.0** | Strict `node_modules` means a package physically cannot import what it hasn't declared — a second enforcement layer behind the ESLint boundary rule. Matters most for `domain`, which must stay dependency-free. See [ADR 0001](./adr/0001-workspace-tooling.md). |

Both pinned in `mise.toml` at the repo root, so `cd` into the project and they activate. **One-time setup:** `mise trust && mise install`. `packageManager` in the root `package.json` mirrors the pnpm pin.

No Turborepo. Four packages, three consumed from source, nothing slow enough to cache — [ADR 0001](./adr/0001-workspace-tooling.md) records the trigger for revisiting.

## Language

|            | Version                 | Why                                                                                                                                                                                                                          |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript | **6.0.3** — _not_ 7.0.2 | Deliberate pin. typescript-eslint peers cap at `<6.1.0`, even on `canary`. TypeScript 7 is the native compiler and is latest, but taking it means giving up typed linting. See [ADR 0006](./adr/0006-typescript-6-not-7.md). |

ESM throughout (`"type": "module"`). Beyond `strict`, `tsconfig.base.json` sets:

- `noUncheckedIndexedAccess` — a league table lookup that might miss should be typed as maybe-missing. Directly load-bearing given how much of this codebase indexes into arrays of clubs and players.
- `exactOptionalPropertyTypes` — `undefined` and absent are different things in a save file.
- `verbatimModuleSyntax`, `erasableSyntaxOnly`, `isolatedModules` — keeps the source transpile-only, which is what Vite and Vitest actually do with it.
- `allowImportingTsExtensions` — **relative imports carry `.ts` / `.tsx`, not `.js`.** Nothing here is compiled, and it means bare `node scripts/season.ts` resolves package sources directly: Node strips types natively (which `erasableSyntaxOnly` guarantees is safe) but has no notion of rewriting `.js` back to `.ts`. That is what keeps the headless runners dependency-free — no `tsx`, no `ts-node`.
- `noImplicitOverride`, `noFallthroughCasesInSwitch`.

**`domain`'s `tsconfig.json` sets `"lib": ["ES2023"]` with no `DOM`.** That makes `fetch`, `document` and `localStorage` type errors inside `domain` rather than lint errors — ground rule 1 enforced by the compiler, before ESLint gets a turn.

## Build and test

|                        | Version    | Scope                                                                                                                   |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Vite                   | **8.2.1**  | `app` only. The other three are consumed from source and never build.                                                   |
| Vitest                 | **4.1.11** | Root `vitest.config.ts` with a `projects` array over all four packages — this is what makes one command run everything. |
| @vitest/coverage-v8    | **4.1.11** | Must track Vitest exactly.                                                                                              |
| jsdom                  | **30.0.1** | `app` only                                                                                                              |
| @testing-library/react | **16.3.2** | `app` only                                                                                                              |
| fake-indexeddb         | **6.2.5**  | `persistence` and `app`, dev only                                                                                       |

**`fake-indexeddb` is test-only and exists because neither Node nor jsdom implements IndexedDB at all.** Until named save slots landed, the storage layer had never had a test: `restore()` swallows the failure and starts a fresh season, which is correct behaviour and also meant the whole of `store.ts` was uncovered. A save picker is mostly storage, so the loop — write, list, load, delete — is now driven against a real implementation.

Declared in **both** packages rather than once at the root, and that is the strict-`node_modules` boundary doing its job rather than duplication. A root devDependency would resolve from either package by walking up, which is exactly the undeclared import pnpm's layout exists to prevent — and the ESLint boundary rule would not catch it, because that one matches `@fm/*` specifiers.

### The build stamps its own commit

`packages/app/vite.config.ts` carries the project's **first and only `define`**, and `packages/app/commit.ts` is the first thing anywhere that reads git state. It runs `git rev-parse --short HEAD` through `node:child_process`, catches everything, and answers `dev` — a tarball with no `.git`, or a container without git on the PATH, is not a reason to fail a build over a line in the footer. It sits at the package root rather than under `src/`, so it can never be pulled into the bundle.

**Defined on `import.meta.env.VITE_COMMIT`, not as a bare `__COMMIT__` global, and that is not a style preference.** The root `vitest.config.ts` declares the `app` project **inline** — its own `plugins` and `root` — and does not extend `packages/app/vite.config.ts`. A bare global would therefore not exist under Vitest, and every test that renders the footer would throw a `ReferenceError` at import. An absent `import.meta.env` key is simply `undefined`, which the call site's `?? 'dev'` absorbs, so one expression is correct in a build, under `pnpm dev` and in a test. `packages/app/src/vite-env.d.ts` types it as optional for the same reason: the type should say it can be missing rather than let a call site skip the fallback.

This is a **version in the sense of a build identifier, not a dependency pin** — it says which commit a running page came from when something is reported. The pins in this document are still the only versions anyone decides.

## UI

|                      | Version     |
| -------------------- | ----------- |
| react / react-dom    | **19.2.8**  |
| @types/react         | **19.2.18** |
| @types/react-dom     | **19.2.4**  |
| @vitejs/plugin-react | **6.0.5**   |
| zustand              | **5.0.15**  |

`@types/react*` version independently of React — do not assume they match.

**Zustand** is the store behind the roadmap's "table-heavy screens reading from a store". It holds _projected_ state and dispatches commands; it never becomes a second source of truth. Ground rule 2 still owns state.

### Styling — plain CSS, global, block-element class names

No CSS Modules, no Sass, no CSS-in-JS. **Never** inline styles, style objects, or a JSX `style` prop.

```
packages/app/src/styles/
  tokens.css    custom properties — palette, spacing, type scale
  reset.css
  chrome.css    shared primitives: panels, tables, stat rows, field labels
```

Screens get a sibling `.css` file (`SquadScreen.css`) with block-element names — `.squad-screen`, `.squad-screen__row` — imported for its side effect: `import './SquadScreen.css'`.

**Why not CSS Modules**, given the roadmap originally said so. Modules exist to stop unrelated components' styles colliding — right when components have independent visual identities. These ~40 screens are the opposite: a league table, a squad list and a transfer list are the same object with different columns, sharing one chrome. Scoping guards a collision that shouldn't happen while making "every screen looks identical" harder — you either duplicate the chrome per module or build a `composes:` graph to climb back out of the scoping. It also defeats the block-element naming convention, since the mechanism _is_ generated names.

The roadmap's third risk is screen count. The lever on it is a `chrome.css` good enough that a new screen needs no new CSS — a design-system problem, which wants shared global classes.

**Why not Sass.** Nesting is native and Vite handles it; custom properties beat Sass variables for tokens because they cascade and swap at runtime. Mixins are the only real loss, and composing classes covers it. A CSS compiler also cuts against a codebase whose `domain` has zero dependencies and whose PRNG is ten hand-written lines.

## Lint and format

|                   | Version                                      |
| ----------------- | -------------------------------------------- |
| ESLint            | **10.8.1** (flat config, `eslint.config.js`) |
| typescript-eslint | **8.67.0**                                   |
| prettier          | **3.9.6**                                    |

**No import plugin.** Two reasons, and the second is the real one:

1. `eslint-plugin-import` peers out at ESLint `^9` and cannot be installed alongside ESLint 10 at all. `eslint-plugin-import-x` is the maintained fork that supports `^10`.
2. But even `import-x`'s `no-restricted-paths` matches on _resolved file paths_, and under pnpm a workspace import resolves through a `node_modules` symlink. Whether the zone matches then depends on realpath behaviour in the resolver — a load-bearing rule resting on a resolution detail.

So the boundary is enforced with the built-in **`no-restricted-imports`** against `@fm/*` specifiers instead. Our packages have a naming convention, so specifier matching is exact and needs no resolver. Zero plugins, zero ambiguity.

`import-x` is still worth adding later for `no-cycle`, which specifier matching genuinely can't do. Not needed for M0.

## Persistence

|     | Version   | Scope              |
| --- | --------- | ------------------ |
| idb | **8.0.3** | `persistence` only |

A thin promise wrapper over IndexedDB — not Dexie, because the migration chain is hand-written per [ADR 0005](./adr/0005-persistence.md) and a heavier library would want to own that. Never reachable from `domain`.

## domain

**No dependencies. None.** Not runtime, not dev, not peer. `sfc32` is ~10 lines written in-repo per [ADR 0002](./adr/0002-prng.md). If something looks like it needs adding here, the design is wrong.

---

## Commands

```bash
pnpm install
pnpm test -- --run       # always --run; bare `pnpm test` starts watch mode and hangs
pnpm typecheck
pnpm lint
pnpm format
pnpm dev                 # app only, on localhost
pnpm dev:lan             # the same, reachable from the local network (a phone)
pnpm build               # app only; also runs in CI, and is what gets deployed
```

## Deployment

The app is published to **GitHub Pages** at **<https://futbol.pearpages.com>** — a custom domain, HTTPS enforced, on the `pearpages/futbol-manager` repository.

**The custom domain is the reason `packages/app/vite.config.ts` sets no `base`.** The site serves from a domain _root_, so Vite's default `/` is correct and the app's five root-absolute asset paths — the cover, the credit mark, the hub figures, the trophy and the stadium — resolve as written. Under a project page at `/futbol-manager/` every one of them would break, and three are template literals, so a `base` change is not mechanical. If the domain ever goes, that is the work.

There is no `404.html` and none is needed: the app has **no router**, so `/` is the only URL the site ever serves.

|             |                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| Source      | GitHub Actions (`build_type: workflow`) — no `gh-pages` branch, nothing published by commit                            |
| Trigger     | push to `main`, or `workflow_dispatch` for a redeploy with no commit                                                   |
| Gate        | the `deploy` job `needs: check`, so nothing that fails lint, typecheck, the suite or format can reach a public address |
| Artifact    | `packages/app/dist`, about 6 MB, most of it the stadium ladder                                                         |
| Environment | `github-pages`, restricted to the `main` branch                                                                        |

### The share card

`packages/app/public/og.jpg` — **1200×630, JPEG, 130 KB** — is what a link to the site unfurls as, declared by the Open Graph tags in `packages/app/index.html`.

**Those tags have to be static in `index.html`.** There is no SSR and no prerender, and every unfurler fetches the file without running React — so anything a component injects is invisible to all of them. That also decides the language: the app picks one from `localStorage` long after a crawler has gone, so one static answer had to be chosen, and it is English for reach while `lang` stays `ca-ES` because that is what the page opens in.

**`og:image` must stay an absolute URL.** A scraper does not resolve a relative path against the page it found it on; `/og.jpg` looks perfectly correct in a browser and unfurls as nothing.

**JPEG rather than the WebP used everywhere else.** This is the one asset whose whole job is being read by other people's crawlers, and WebP still unfurls unreliably on some of them. PNG was the other candidate and lands about 1.2 MB — over the few hundred KB some chat clients budget for a preview thumbnail. At q92 the lettering is indistinguishable from lossless at 2× zoom, which was checked rather than assumed.

The card is rendered from the real page in headless Chrome, loading the app's own stylesheet so `.landing__wordmark` arrives verbatim — the condensed face, the tracking, the colour and the two-layer shadow all come from source. It is a scripted one-off, not a build step: **a change to the cover art or to the wordmark's styling does not propagate on its own.** `packages/app/src/meta.test.ts` catches a wrong size or a missing file, not a stale picture.

**`packages/app/public/CNAME` is deliberate belt-and-braces.** GitHub applies the custom domain from repository settings, so the site works without it — but that setting was the only copy of the domain, and a file in the artifact means it survives a settings reset.

`.github/workflows/ci.yml` uses `jdx/mise-action@v2` in **both** jobs rather than `actions/setup-node`, so `mise.toml` stays the single source for Node and pnpm and this file never becomes a second one. `actions/configure-pages` is deliberately absent — it writes to the Pages API, and the domain and certificate are already configured; add it only if a run reports Pages is not enabled.

`pnpm build` runs in `check` as well as in `deploy`. CI never built the app until deployment existed, so a change that broke `vite build` passed every check and would only have surfaced after merge; bundling takes about a tenth of a second against an install that is already paid for.

## Upgrade policy

- **Pins are exact.** A version bump is a deliberate commit, never a side effect of installing.
- **Bump Vitest and `@vitest/coverage-v8` together**, always.
- **TypeScript stays on 6.x** until typescript-eslint supports 7 — check [ADR 0006](./adr/0006-typescript-6-not-7.md) before touching it.
- **After any bump, `pnpm test -- --run` must stay green including the N-season statistical harness** (from M1). A dependency that shifts a floating-point result shows up there and nowhere else.
