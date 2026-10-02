# Futbol Manager

A football management game in the style of Dinamic's PC Fútbol, played in the browser. There
is no real-time match engine: results are worked out statistically from team ratings. The
first delivery targets PC Fútbol 5.0 (1996/97): one league, squads, tactics, transfers and an
economy. The depth of the later games is where it is heading, not what v1 covers (see
[ADR 0008](docs/adr/0008-target-pc-futbol-5.md)). It is a static React app published from
`main` to <https://futbol.pearpages.com> through GitHub Pages. Saves stay in the player's
browser.

## Project documents — read before working

| File                               | Holds                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| [principles.md](principles.md)     | The rules every change must follow (the ground rules live here)              |
| [architecture.md](architecture.md) | How the project is built: packages, data flow, build, deploy                 |
| [decisions.md](decisions.md)       | Index of ADRs in `docs/adr/`: why each choice was made                       |
| [tasks.md](tasks.md)               | Open work and the dated log of what was done                                 |
| [security.md](security.md)         | Threat surface, secrets, dependency policy, how to report a vulnerability    |
| [LICENSE](LICENSE)                 | Proprietary, all rights reserved: the source is visible, nothing is licensed |

Domain references. Read the one that covers the area you are changing:

| File                                               | Holds                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| [docs/roadmap.md](docs/roadmap.md)                 | What to build and in what order (M0–M7), risks, known open items       |
| [docs/stack.md](docs/stack.md)                     | **The only place a version number is decided**; hosting and deployment |
| [docs/attribute-model.md](docs/attribute-model.md) | The player spec, and how the XI becomes a team rating                  |
| [docs/market-model.md](docs/market-model.md)       | What a player is worth, who sells him, and the balance invariants      |
| [assets/README.md](assets/README.md)               | Rules for the local, untracked PC Fútbol reference screenshots         |

[README.md](README.md) is the user-facing entry point.

## Working rules

1. **Read `principles.md` before changing code or docs.** If a change would break a
   principle, stop and ask instead of working around it. Do not reopen an ADR's question
   without saying why the ADR is wrong.
2. **Know which side of the 5.0 / 2001 line a feature sits on** before adding it. M0–M5 is
   the 5.0-shaped game and M6–M7 is the move toward 2001.
3. **Every change updates `tasks.md`**: tick or add Open items, and add a dated line at the
   top of Done.
4. **A structural or behavioural change updates `architecture.md` in the same commit**, and
   updates the README too when users can see it. A milestone moving updates `docs/roadmap.md`,
   and so does a stretch of work that touches no milestone.
5. **A choice between real alternatives** (API shape, dependency, convention, process) gets
   a new ADR in `docs/adr/` plus a line in `decisions.md`. Propose it to the user before
   marking it Accepted. Never edit an accepted ADR; supersede it with a new one.
6. **Anything touching saves, input handling or dependencies is checked against
   `security.md`**, and updates it when the surface changes.
7. **At the end of a session, outcomes go to those files, not here.** A finding about the
   game's model goes in the reference doc it belongs to (`attribute-model.md`,
   `market-model.md`, `stack.md`). A trap goes under Pitfalls below. This file keeps only how
   to work and pointers, never a session log.
8. Confirm before anything outward-facing. A push to `main` **deploys the public site**.

## Development commands

First-time setup: `mise trust && mise install && pnpm install` (`mise.toml` pins Node and pnpm).

- `pnpm test -- --run`: the whole suite, once. Bare `pnpm test` starts watch mode and hangs.
- `pnpm exec vitest run --project <domain|data|persistence|app> <file>`: one file, fast.
  `pnpm test -- --run <name>` does **not** filter; the `--` swallows the name and all files run.
- `pnpm season [seed]`: a headless season that prints the final table. Byte-identical across
  runs for a seed, which makes it the cheapest determinism check there is.
- `pnpm fixture`: write a save fixture for the **current** schema version. Run it _before_
  adding the next migration, never after.
- `pnpm typecheck` · `pnpm lint` · `pnpm format` (`pnpm format:check` in CI)
- `pnpm build`: the production bundle, into `packages/app/dist`.
- `pnpm dev`: the app on a Vite dev server.

## Pitfalls that have bitten before

- **Green suite, broken screen.** The app project runs with `css: false` and jsdom does no
  layout, so clipping, overflow, wrapping, colour and stacking are invisible to every test.
  Look at it in a real browser. Use the Chrome extension to look, and headless Chrome over CDP
  against `pnpm build && vite preview` to measure or to drive a `<select>`.
- **Chrome extension returns `[]`.** That means its service worker is asleep, not that the
  install is broken. Bring Chrome to the front with the Claude side panel open, then call it.
- **Port 4173 serves another app.** A service worker from a different project owns that
  origin. Preview on `--port 4321 --strictPort`. The tell: `curl` gets the right `<title>`
  and the browser shows a different page.
- **`pnpm fixture` after a migration** cannot capture the version you just left, because it
  stamps the version from the live chain. Run it first.
- **`git stash` in a shared tree** stashes other sessions' work. Compare against HEAD with
  `git worktree add --detach <dir> HEAD`. Warm the worktree with one command first, because
  pnpm's install preamble lands in stdout and breaks a byte comparison.
- **A test written after the fix passes for free.** Check every new test against the broken
  code, one mutation at a time. A mutation that fails the wrong test proves nothing either.
  After an interrupted mutation sweep, run `git status`: a killed runner skips its own restore.
- **Run-together accessible names.** `visually-hidden` or badge text inside a text-bearing
  element needs its own leading space. Shipped as `CanteraM7`, `20Relegated`,
  `Temporada 1En joc` and `pearpages7f1e3eb`.
- **Orphan dictionary keys.** `dictionaries.test.ts` enforces parity across the three
  languages and cannot see a key with no call site. Grep by hand when removing a string.
- **The clock never enters July.** Seasons start on 15 August and `StartNewSeason` jumps
  straight to the next 15 August. Anything keyed on July or 1 August has to be checked by
  hand, because no career will ever exercise it. This has caused three defects.
- **A comment is scanned as the rule.** CSS and text guards that read a file must strip
  comments first, because the comment explaining a removal names the thing removed.
- **One stochastic run is luck.** A test comparing two single seasons passes or fails on
  noise. Statistical claims belong in the harness, over many seasons.
- **zsh does not word-split** an unquoted `$var`. Use arrays and `"${arr[@]}"`.
  `cmd | tail` throws away `cmd`'s exit code.
