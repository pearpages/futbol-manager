# Tasks

What's open and what's been done. Every change updates this file: tick or add an Open
item, and add a dated line at the top of **Done**. Milestone-sized work is planned in
[docs/roadmap.md](docs/roadmap.md); this file tracks the concrete items. Until 2026-08-21
outcomes were logged as narrative in `CLAUDE.md`. That text survives in git history (last
at `0f75a23`), and each entry is one Done line below.

## Open

### Next milestones

- [ ] **M5c — Sponsorship**: named deals (shirt, kit, training, cars, clothing) that come and go with performance, deterministically, with a warning before any deal ends. Decide whether a multi-year deal is state on `Club` (schema bump) or derived from form. — [roadmap](docs/roadmap.md#m5c--sponsorship)
- [ ] **M6 — Living squad**: injuries, suspensions, form, morale and training, hung off `AdvanceDay`. Injuries will want a second rng stream in the save envelope (P7). — [roadmap](docs/roadmap.md#m6--living-squad)

### Known open items

Small, real, and deferred more than once. They moved here from the roadmap on 2026-10-02.

- [ ] **Matchday number disagrees by one.** `TableScreen.tsx` computes `Math.ceil(played / 10)`, which is rounds _completed_, while the hub and title bar show the round _about to be played_. A one-line fix, deferred twice as "a screen this change was not asked to touch". Decide which number is right and make both sites say it.
- [ ] **Disabled-tile accessible name reads `CanteraM7`.** In `HubScreen.tsx` the label and milestone spans are adjacent with no separator. Fixing it is one attribute (`aria-hidden` on the badge, whose `title` already carries the milestone). A test builds the expected name as `` `${label}${tile.milestone}` ``, so the test changes with the fix.
- [ ] **The overdraft has no teeth.** `board.ts` judges league position and nothing else. This was a deliberate cost at M5b: a club may run to its limit and nobody mentions it. Debt becomes a consequence once there is something to attach it to.
- [ ] **The harness is still blind to the tactics slider.** `simulate.harness.test.ts` runs every club on balanced tactics in 4-4-2. The formation sweep (`packages/data/src/formations.harness.test.ts`, re-derived at 50 seasons on 2026-08-18) covers approach by strength, squad shape and formation × slider. The slider alone and the 50-season distribution bands remain balanced-only.
- [ ] **Five breakpoints with no shared token.** The screen stylesheets use 48, 52, 60, 64 and 68rem, and `App.css` has none. Each was picked where one grid broke, which is defensible per screen and incoherent across ten. A `--fm-break-*` token set would make them one decision.
- [ ] **The title bar cannot reflow.** `.shell__bar` is a non-wrapping flex row, and `.shell__title` is `flex: 1` with no `min-width: 0`, so the bar overflows rather than wrapping when narrow. One declaration, but it changes how the title truncates, so look at it.
- [ ] **Distribution bands still run on generated squads.** `simulateSeasons` takes `rosters` and the formation arms use them. The 50-season bands still run on `TEST_CLUBS`, where generated squads are arguably right because they describe the shape of a league rather than this one.
- [ ] **`TableScreen`'s "Últims resultats" is a weaker copy.** It reads `store.feed` (capped at 60, which does survive a reload), while `ResultsScreen` reads `season.fixtures`. The weaker of two copies keeps winning the click. Decide deliberately whether to remove it.
- [ ] **The results grid pushes the page 14px at a 500px viewport.** The classification and the squad contain themselves at that width. Neither `min-width: 0` on the scroller nor `overflow-x: hidden` moves it, so the cause is further up the shell. Everything from 900px up is clean.
- [ ] **The landing cover overlaps the aside at 900×650.** `.landing` keeps `height: 100%` in the `width < 60rem` branch, so the hero compresses to 292px against a 496px image and spills over the tagline and both buttons. It is identical at HEAD and probably needs `height: auto`. Re-measure at 820×600 too.
- [ ] **`BAR_FLOOR = 45` contradicts its own comment ("plotted from 40").** In `PlayerScreen.tsx` an attribute of 45 draws an empty bar. Measure the league's lowest attribute first, then fix one of the two. Generation also gives a player very little internal spread (the best keeper spans 71–80), which limits the radar more than the floor does.
- [ ] **Stadium expansion is a dominant strategy.** `occupancy` never reads `capacity` (`finance.ts`), so gate income is linear in seats. A bigger ground also raises `debtLimit` and lowers `wagePremium`. It needs a demand ceiling. This will move calibrated bands.
- [ ] **A season reaches only nine settlement days.** Settlement is the 1st of the month, and the clock runs 15 Aug → 1 May, so wages, TV and sponsorship are paid at 9/12. `calendar.test.ts` pins the nine dates and will fail loudly when this is fixed.
- [ ] **Occupancy can read over 100%.** The price multiplier is applied after the 0.98 cap (a top club at the cheapest ticket computes 127.4%), while the gauge clamps. — `finance.ts`
- [ ] **`ageFactor`'s docstring says values peak at 24–27, but the table peaks at 19–21**, and `valuation.ts` says "69.54" where its constants give 70.04. — `valuation.ts`
- [ ] **The youth premium buys nothing**: attributes never change until M6 training lands.
- [ ] **Bidding below the asking price is never correct.** `answerBid` is deterministic, so the fee field looks like a negotiation and is not one.
- [ ] **Barcelona's navy badge rim nearly vanishes at 20px** on `--fm-screen` (market, results grid). The lever is that screen's badge size, not the palette.
- [ ] **Stadium ladder's low end is compressed**: tiers up to ~12 differ little in architecture, and the CSS height carries it. `public/art/stadium/small/` holds four undeclared village grounds that would sit below `6k`.
- [ ] **`ShellFoot.test.tsx` quick-save race** reproduces under two concurrent full suites: it asserts `queryByRole('dialog')` synchronously while the close lands a tick later.
- [ ] **`competition.name` is still `'Primera División'` inside `GameState`**, so the title bar names it while the rest of the app no longer does. It needs a migration.
- [ ] **`es.ts` keeps the calques fixed in Catalan** (`en el idioma de`, `el calendario`, `Mostrando`, `cubrir este sistema`). `attribute.short.finishing` (`DEF`) collides with `position.DF` on the ficha.
- [ ] **Verify the Open Graph card unfurls** in a real client now that the tags are live.
- [ ] **`/favicon.ico` 404s** on the live site.
- [ ] **`importSave` / `exportSave` are unwired.** When they are wired, validate imported saves (see security.md).

### Scaffold follow-ups

- [ ] **Source comments still cite `CLAUDE.md`** as the record (`Explain.test.tsx`, `explain-topics.ts`, `calendar.test.ts`, `vitest.config.ts`). Repoint them to the doc that now holds each fact. Code was out of scope for the scaffold.
- [ ] **Pin GitHub Actions by commit SHA** instead of by tag — security.md, `.github/workflows/ci.yml`
- [ ] **Decide on dependency update/audit tooling** (Dependabot, or `pnpm audit` in CI) — security.md

## Done

- [x] 2026-10-02: Scaffolded project knowledge files. Created AGENTS.md, principles.md, architecture.md, decisions.md, ADR 0013, security.md, tasks.md, README.md, LICENSE and .editorconfig. CLAUDE.md is now a shim, its session log became the Done lines below, and the roadmap's Known open items moved here.
- [x] 2026-08-21: Open Graph metadata and a 1200×630 share card rendered from the real landing page, guarded by `meta.test.ts`.
- [x] 2026-08-21: CI builds on every PR and deploys `main` to GitHub Pages at futbol.pearpages.com.
- [x] 2026-08-21: The hub's next match shows both crests in home–away order; the play button is pinned to the panel foot.
- [x] 2026-08-21: Barcelona and Benicalap badges recoloured (`garnet-blue-white`); classification crests at 28px; club badges carry a `<title>` tooltip.
- [x] 2026-08-21: Removed the "what is this" heading and the second tagline sentence from the landing page.
- [x] 2026-08-21: The market table pages at 40 rows (`.pager` in chrome.css); the suite no longer times out under load.
- [x] 2026-08-21: Stadium drawings are named by seat count (`6k`–`200k`) and the nearest is shown, with variants hashed from the club id.
- [x] 2026-08-19: Thirty stadium drawings regenerated by banked-stand count, with architectural style tracking size.
- [x] 2026-08-19: Stadium ladder rebuilt on a countable storey ladder at a 40° camera.
- [x] 2026-08-19: Stadium rungs re-sorted into true size order.
- [x] 2026-08-19: Stadium ladder anchored so tier 22 means ~60k seats; 30 rungs.
- [x] 2026-08-19: Stadium ladder widened to 24 rungs with a size ramp in CSS.
- [x] 2026-08-19: Generated club badges tried and reverted to the drawn ones; the chroma-key spill fix kept.
- [x] 2026-08-19: Hub figures, trophy and stadium replaced with generated art; ~2,000 lines of pixel-art code removed.
- [x] 2026-08-19: Catalan reviewed against the norm: imperative buttons, orthography, `clubPhrase` for articles before club names.
- [x] 2026-08-19: The cover redone as generated box art with a live wordmark (ADR 0012).
- [x] 2026-08-19: Cross-border signings can be completed (`playersById` includes foreign squads).
- [x] 2026-08-18: Landing page with a pixel-art cover, Continue / Load / New career, and the build hash in the footer.
- [x] 2026-08-18: The Clubs tab picks from a wall of crests instead of a dropdown.
- [x] 2026-08-18: Real-shaped squads abroad from Wikipedia with altered names; ADR 0011 decision 4 reversed.
- [x] 2026-08-18: A market abroad: 32 foreign clubs as a player source (schema v10, ADR 0011).
- [x] 2026-08-18: Market volume doubled: `valueFloorFor` and two signings for rich clubs, with a volume harness.
- [x] 2026-08-18: The player leak closed with youth top-up and free-agent patience.
- [x] 2026-08-18: Diagnosed the Chrome extension: its service worker sleeps, and `localhost` was granted.
- [x] 2026-08-18: Any player can be bid for at a reluctance premium; Clubs tab and bid dialog.
- [x] 2026-08-18: A different fixture calendar every season, seeded from the year; formation harness moved to real rosters.
- [x] 2026-08-17: Contract renewal from Plantilla and the ficha; expiry warnings; releases and retirements announced.
- [x] 2026-08-17: Stadium drawn as modules, with unbuilt ones ghosted (later replaced by generated art).
- [x] 2026-08-17: Pixel-art stadium that grows with capacity (later replaced).
- [x] 2026-08-17: Results gets a per-matchday view; the grid is easier to read.
- [x] 2026-08-17: Calendar screen with the transfer deadlines and settlement days interleaved.
- [x] 2026-08-17: Results cross-table, Palmarès with a trophy, and `GameState.history` (schema v9).
- [x] 2026-08-17: Explainers (`<Explain>`, `explain-topics.ts`) and the `.hint` primitive.
- [x] 2026-08-17: The pearpages credit footer, the first binary asset.
- [x] 2026-08-17: `TV_POOL` raised ×1.5 as the league's equaliser.
- [x] 2026-08-16: Lineup screen relaid as two columns and verified in a browser.
- [x] 2026-08-16: Alineació and Tàctiques merged into one screen with a pitch view; Entrenaments tile badged M6.
- [x] 2026-08-16: Save opens the dialog; legacy saves are adopted; IndexedDB blocked/self-heal handling.
- [x] 2026-08-16: Named save slots and `Modal`, the app's first dialog.
- [x] 2026-08-15: Selling is judged by the manager's own team sheet (`saleBlock`), not a 4-4-2.
- [x] 2026-08-15: Radar labels no longer clip; the ficha splits 50/50.
- [x] 2026-08-15: Every player name links to his ficha (`.player-link`).
- [x] 2026-08-15: Tempo shown on the lineup screen.
- [x] 2026-08-15: Hub figures animate their props and smile on hover.
- [x] 2026-08-15: Four more formations (4-5-1, 5-4-1, 3-4-3, 4-2-4) with `FORMATION_TEMPO`.
- [x] 2026-08-15: Every table sorts (`sorting.ts`, `SortHeader`).
- [x] 2026-08-15: Squads given a real top and tail (value normalised by position).
- [x] 2026-08-15: Rating scale moved onto PC Fútbol's range (60–94).
- [x] 2026-08-15: League rebuilt from real squad values and shapes (ADR 0010).
- [x] 2026-08-15: Roadmap brought up to date with the polish phase and Known open items.
- [x] 2026-08-15: League position moved to the hub, coloured by band.
- [x] 2026-08-15: The hub's ten-match form strip.
- [x] 2026-08-15: The transfer-window badge counts down the days.
- [x] 2026-08-15: Pixel-art figures on the four hub sections.
- [x] 2026-08-15: The economy made legible: bonus shown before a bid, overdraft as headroom, wages on Plantilla, `seasonProjection`.
- [x] 2026-08-15: Transfer-window badge and `TransferWindowChanged`; first time the game was seen in a browser.
- [x] 2026-08-14: Ficha radar, comparison, and the model explained from live weights.
- [x] 2026-08-14: Completing a transfer from the outbox fixed (scroll, `key`, refusal feedback).
- [x] 2026-08-14: Real stadium capacities; `FINANCE.TICKET` doubled.
- [x] 2026-08-14: Catalan, Spanish and English; the news drawer removed.
- [x] 2026-08-14: M5b: the board, ticket pricing, stadium expansion, and the Caja/Decisiones/Estadio screens.
- [x] 2026-08-14: M5a: revenue, wages, debt and the ledger (ADR 0009).
- [x] 2026-08-14: Section colours and tile icons on the hub.
- [x] 2026-08-14: Squad numbers on Plantilla; the title bar shows league standing.
- [x] 2026-08-14: Club badges.
- [x] 2026-08-14: The nav rail removed; the hub is the only branching point.
- [x] 2026-08-14: Hub, news feed and a deliberate matchday press.
- [x] 2026-08-14: ADR 0007 (IP) and ADR 0008 (target 5.0); local reference assets.
- [x] 2026-08-14: `market-model.md` written; need score hidden and listings shuffled.
- [x] 2026-08-14: Market's 60-row cap removed; filters and sortable columns added.
- [x] 2026-08-14: M4c: the sell side, the transfer list and weekly offers.
- [x] 2026-08-14: M4b: bids, terms, free agents and the market screen.
- [x] 2026-08-14: M4a: a self-running market, contracts and season rollover.
- [x] 2026-08-14: M3c: club picker and tempo.
- [x] 2026-08-14: Measured what actually moves results (keeper ≈ 2.5× any other signing).
- [x] 2026-08-13: M3b: first screens, Zustand store, IndexedDB save/load.
- [x] 2026-08-13: M3a: players, formations, team ratings and the migration chain.
- [x] 2026-08-13: M2: Poisson result resolver, calibrated over 50 seasons.
- [x] 2026-08-13: M1: league, fixtures, tiebreakers, `reduce` and the season harness.
- [x] 2026-08-13: Styling switched to plain global CSS; M0 closed.
- [x] 2026-08-13: `docs/stack.md`, pnpm (ADR 0001 reversed), TypeScript 6 pin, M0 skeleton.
- [x] 2026-08-13: Roadmap refined, `attribute-model.md`, first ADRs.
