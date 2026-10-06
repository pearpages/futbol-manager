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

### Advertising readiness

- [ ] **A `release` skill** (ADR 0020). Capture what releasing `v0.6.0` took: find the player-facing changes since the last tag, write the notes for players, pick the version, `gh release create`, and update the README's What's new. Also say how many player-facing changes are waiting unreleased.

### Phone follow-ups (ADR 0019)

- [ ] **First-visit tips** on Today, Team and Market: one dismissible sentence each, remembered per browser. Proposed in the phone audit and not built yet.
- [ ] **The negotiation panel on a phone** is still the side rail's panel, shown above the list. A bottom sheet would keep the list in place.
- [ ] **Starting the season and leaving when sacked** were proposed for confirmation and left out: both are the only way forward from where they appear. Revisit if players press them by mistake.
- [ ] **The Design System artifact is out of date**: it predates the phone shell, `Icon`, `TabBar`, `Segments`, `Confirm` and `Toast`. Republish it.

### Storybook follow-up (ADR 0021)

- [ ] **Render the component previews from the stories.** Each component is described twice, its `preview.html` (for the Claude artifact) and its story, and the two can drift. Build the previews from the stories, or replace them once the artifact can load a Storybook build.

### Real data (ADR 0024, 0025)

- [ ] **Refresh the foreign league.** Its 32 rosters are the August 2026 snapshot: some players it holds have since moved, nine of them into the league, where they now appear under new names while their foreign copies remain.
- [ ] **A value for newcomers from unmodelled clubs.** About 45 arrivals hold their club's median value for their position, so a star signing from outside the game starts mid-pack. Options: estimate from Wikipedia's caps, age and previous club; or set the notable signings by hand.

### Known open items

Small, real, and deferred more than once. They moved here from the roadmap on 2026-10-02.

- [ ] **Disabled-tile accessible name reads `CanteraM7`.** In `HubScreen.tsx` the label and milestone spans are adjacent with no separator. Fixing it is one attribute (`aria-hidden` on the badge, whose `title` already carries the milestone). A test builds the expected name as `` `${label}${tile.milestone}` ``, so the test changes with the fix.
- [ ] **The overdraft has no teeth.** `board.ts` judges league position and nothing else. This was a deliberate cost at M5b: a club may run to its limit and nobody mentions it. Debt becomes a consequence once there is something to attach it to.
- [ ] **The harness is still blind to the tactics slider.** `simulate.harness.test.ts` runs every club on balanced tactics in 4-4-2. The formation sweep (`packages/data/src/formations.harness.test.ts`, re-derived at 50 seasons on 2026-08-18) covers approach by strength, squad shape and formation × slider. The slider alone and the 50-season distribution bands remain balanced-only.
- [ ] **Five breakpoints with no shared token.** The screen stylesheets use 48, 52, 60, 64 and 68rem, and `App.css` has none. Each was picked where one grid broke, which is defensible per screen and incoherent across ten. A `--fm-break-*` token set would make them one decision.
- [ ] **Distribution bands still run on generated squads.** `simulateSeasons` takes `rosters` and the formation arms use them. The 50-season bands still run on `TEST_CLUBS`, where generated squads are arguably right because they describe the shape of a league rather than this one.
- [ ] **`TableScreen`'s "Últims resultats" is a weaker copy.** It reads `store.feed` (capped at 60, which does survive a reload), while `ResultsScreen` reads `season.fixtures`. The weaker of two copies keeps winning the click. Decide deliberately whether to remove it.
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
- [ ] **`importSave` / `exportSave` are unwired.** When they are wired, send imports through `readSave` and `isGameState`, as `restore` does (security.md).

### Design system and mobile layouts

- [ ] **Decide: merge the near-duplicate colours.** `chip-fw` (`#e08a7e`) and `relegation-tint` (`#e8a79c`) are close but not equal, and screen headings use 0.02em tracking and a few labels 0.04em beside the two tracking tokens. Merging is a visual change.
- [ ] **Commit the artifact staging script.** The Claude Design System artifact (https://claude.ai/artifact/AdUCGn6WHkjuxjMZtL2sa9) was published from a script that reshapes the package into the artifact's format; it lives outside the repo. Commit it as a package script so republishing is one command.
- [ ] **The lineup's pitch discs are just under 24px to press** on a phone (they scale with the SVG). Give each slot a larger invisible hit circle.

### Audit 2026-10-03

Explained in plain words in [docs/audits/2026-10-03.md](docs/audits/2026-10-03.md). Four read-only passes: game model, UI and accessibility, code health, security and dependencies. Every high item was reproduced. The scratch repros are not in the repo; the descriptions carry what is needed to reproduce.

**Game model**

- [ ] **Renewals: pay cuts are free, and doing nothing beats renewing.** `offerTerms` (`bids.ts:268`) judges a renewal against `wanted`, never the current wage, so renewing at `wanted` cuts the wage bill 2–10% and can be repeated every August. The rollover (`season.ts:636-645`) re-signs retained players at `expectedWage`, below `wanted`, so leaving a contract to expire is cheaper than renewing it (P10). Fix: floor renewals at the current wage, and have the rollover ask the managed club's players for `wanted` or release them.
- [ ] **Club ratings are frozen, yet sponsorship, crowds, the overdraft and the board read them.** `Club.attack/defence` never changes after creation but drives `occupancy`, `sponsorMoney`, `annualIncome`/`debtLimit` (`finance.ts:236,292,327`) and `standingOf` (`board.ts:62`). Signing a 92-rated player moves sponsorship by 0, contradicting market-model.md ("sponsorship tracks the squad"). Fix: derive them from the live best XI or refresh at rollover. This will move bands; re-measure.
- [ ] **Every career starts from the same seed.** `store.ts:311` always uses `START_SEED = 20260813`, so two careers at the same club with the same commands play identically. Decide: seed each career (chosen outside `domain`, stored in the save) or record the fixed seed in an ADR.
- [ ] **market-model.md's free-agent pool figure is out of date.** It says the pool holds at 20–31; with the foreign league it runs 36–53 after 10–12 seasons. Re-measure and correct the doc.

**UI and accessibility**

- [ ] **The focus ring disappears on light panels.** The global `:focus-visible` outline is brass (`chrome.css:643`), 1.02:1 against `--fm-panel`, so the footer buttons, the cog and the landing buttons show focus only by hue. Fix: an ink outline inside `.panel`, or a double ring.
- [ ] **Accessible names lack context or read badly.** Market, Lineup and Squad row buttons are all just "Segueix"/"Ofereix", "Canvia" or "Renova" (`MarketScreen.tsx:628-637`, `LineupScreen.tsx:154-160`, `SquadScreen.tsx:220`); add the player's name. Sort buttons read as "J", "G", "E", "P" (`SortHeader.tsx:33-40`); add full-word labels in all three dictionaries. The hub crest reads "Madrid MADRID" (`HubScreen.tsx:248-251`). Explain buttons inside headings add "Explica: …" to the heading's name; move them out of the `<h2>`. Language choices have no `lang` (`SettingsMenu.tsx:43-54`).

**Code health**

- [ ] **`pnpm fixture` writes a save shape the app never writes.** `scripts/fixture.ts:31` calls `newSeason` without `rosters` or `foreign`, so the next `v10.json` would have no foreign league and generated squads, and the v10→v11 migration would be tested against the wrong shape. Fix before the next schema bump: build it the way `freshGame` does, or share one factory.
- [ ] **Logic duplicated in two or three places.** The seller's price is computed in `MarketScreen.tsx:207` and `BidPanel.tsx:46-48`; make it one domain `sellerPrice`. Ticket bounds are computed in `EstadioScreen.tsx:57-58` and `reduce.ts:1228-1229`; make it one `ticketRange()`. "Who holds this player" exists three times (`PlayerScreen.tsx:175-190`, `reduce.ts:591`, an unused `foreignHolderOf` in `foreign.ts:377`). `marketSeed` (`MarketScreen.tsx:92-97`) hand-rolls `hashSeed` (P7).
- [ ] **Dead code and stale references.** Unused exports: `clubRating` (`entities.ts:130`), `isPlayed` (`entities.ts:176`; `result !== null` is written inline 21 times), `foreignHolderOf`. `windowKey` and `squadValue` don't need exporting. `.panel__title` (`chrome.css:24`) is unused. `idb` is declared in `packages/app` but never imported, and `@fm/data` should be a devDependency of `persistence`. `PitchView.tsx:20` cites a deleted `sprites.ts`, `market.volume.harness.test.ts:20` cites an old harness file name, and `packages/app/tsconfig.json` includes a missing `vitest.config.ts`.
- [ ] **Decide: P11 says imports never "skip a step", but they do.** `app` imports `@fm/domain` 43 times and `@fm/data` 19 times, and `persistence` imports `@fm/domain`. The lint rules and ADR 0001 only forbid reversal. Rewording P11 to "never reverses" is a principle change and needs agreement.

**Security and dependencies**

- [ ] **No Content Security Policy.** GitHub Pages can't send headers, but the built `index.html` has no inline script or style, so a strict meta CSP fits: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; manifest-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'`, plus `<meta name="referrer" content="strict-origin-when-cross-origin">`. Inject it only at build (a Vite `transformIndexHtml` plugin with `apply: 'build'`), because the dev server's HMR breaks under it, and add a test against `dist/index.html`.
- [ ] **The custom domain may not be verified.** `protected_domain_state` is null. If Pages were turned off while DNS still points at GitHub, another account could claim `futbol.pearpages.com`. Verify `pearpages.com` under account Settings → Pages.

### Architecture review 2026-10-03

Explained in plain words in [docs/audits/2026-10-03.md](docs/audits/2026-10-03.md). Measured with a module import graph: 125 source files, plus cycle detection, fan-in and fan-out, and the symbols each package takes from the others.

The layers hold:

- No package import reverses direction, and lint enforces it.
- `domain` is pure.
- `persistence` migrations are self-contained.
- Screens never use `getState`, and every state change goes through `reduce`.

What is weak is cohesion and coupling _inside_ the packages. Two modules, `store.ts` and `reduce.ts`, act as hubs that everything passes through. The UI also reaches past the domain's rules into their ingredients. A target shape (store slices, domain query API, feature folders) is a choice between alternatives, so it should be proposed as an ADR before the refactor starts.

- [ ] **Propose an ADR for the target module structure.** Cover the items below: how the store is split, the domain's public query API, where the composition root lives, and the feature folders. Agree it before moving code, so the refactor lands as a series of small, behaviour-neutral commits (`pnpm season` byte-identical after each).
- [ ] **The UI computes rules from their ingredients, so screens and the reducer disagree.** `app` imports 91 distinct `@fm/domain` symbols, including rule primitives: `signingOutlay`, `reluctancePremium`, `askingPrice`, `debtLimit` and `canAfford` (MarketScreen alone uses 16). Each screen re-derives the answer, which is how three audit bugs arose:
  - the seller's price is computed twice;
  - the ticket bounds are computed twice;
  - the stadium affordability check disagrees with the cost the screen shows.

  Fix: domain exposes use-case queries that return answers, such as `bidQuote(state, playerId)`, `stadiumQuote(state)`, `ticketRange()` and `marketListing(state)`. The reducer validates with the same functions the screens display, and screens stop importing the primitives.

- [ ] **`store.ts` is a god object.** It is 690 lines, imported by 22 modules, and mixes six concerns:
  - the game session (`game`, `dispatch`, `feed`, `unread`);
  - navigation (`screen`, `entry`, inspected or compared player, `marketTab`, `browsingClubId`);
  - preferences (`language`, `localStorage`);
  - saves (slots, save, load, restore, adopt, `storageBlocked`);
  - the career lifecycle;
  - matchday automation (`advanceToMatchday`).

  14 of 33 screens subscribe to the whole `game`, so they re-render on every change. Fix: split it into slices or stores (session, navigation, preferences, saves) with narrow selectors.

- [ ] **The composition root lives inside the game store.** `store.ts` is the one module that imports `domain`, `data` and `persistence` together. `freshGame` assembles a career (rosters, foreign league, `FOREIGN_BUDGETS`, `START_SEED`) behind a module-level mutable `let rng`. Fix: a `career.ts` (or a small package) that composes data and domain into `newCareer(clubId, seed)` and `nextSeason(game)`, with the store only holding the result. This is also where `pnpm fixture` should get its game from (see the fixture item above).
- [ ] **Reference data rides on commands.** `StartNewSeason` carries `names`, `foreignNames` and `foreignBudgets` every season (`store.ts:681-689`). Every caller of the reducer must therefore know the `data` package, and a script or import that passes different tables silently changes the world. Fix: fix the reference data at career creation (in `GameState`, or an injected `World`) so the command is just `{ type: 'StartNewSeason' }`. Needs a schema bump.
- [ ] **`reduce.ts` has low cohesion.** It is 1520 lines:
  - the Command and Event protocol (≈420 lines);
  - 13 handlers across five subdomains (lineup, season, transfers, finance and stadium, the day pipeline);
  - the AI market tick (1052-1225);
  - monthly settlement.

  The subdomain modules (`market.ts`, `bids.ts`, `finance.ts`, `season.ts`) hold the rules while their state transitions sit here, so one transfer change touches three files. Fix:
  - `reduce` becomes a dispatcher;
  - handlers move beside their rules (`transfers.ts`, `stadium.ts`, `day.ts`);
  - Command and Event move to `commands.ts` and `events.ts`.

- [ ] **Market logic and randomness live in the UI.** `MarketScreen.tsx:67-243` builds the transfer listings (`listingsFor`, `scoutedPrice`, `marketSeed`) and shuffles them with `createRng` + `shuffle`. That is model behaviour in the app layer, invisible to the harness (the spirit of P2), and it hand-rolls `hashSeed` (P7). Fix: move it to domain as `marketListing(state)`, then split `ClubBrowser` and `NegotiationPanel` into their own files.
- [ ] **The domain package has no public API.** 22 modules sit in one flat folder, and `index.ts` re-exports about 236 names, nearly everything, including the harness driver `simulate.ts`. Nothing separates what other packages may use from internals. Fix: export the use-case queries, commands, events and entity types. Move the simulation entry points to a `@fm/domain/testing` export. Consider subfolders per subdomain (`market/`, `finance/`, `season/`, `match/`).
- [ ] **Derived data is recomputed in many places.** `computeTable` is called from 6 app modules on every render, and other derivations (form, standing, wage bill) repeat across screens. Fix: one memoised selector per derived value, either domain queries or `app/src/selectors.ts`.
- [ ] **Translation depends on the game store.** `useT` imports `useGame` to read the language. `store` imports `notifications` at runtime, which imports `useT`'s types, which closes the cycle store → notifications → useT → store. Fix: language in its own preference store or context; `notifications.ts` stays pure and takes a translator.
- [ ] **`app/src/screens` is a flat folder of 37 modules.** It mixes screens, shared widgets (`Modal`, `Pager`, `SortHeader`), feature panels (`BidPanel`, `RenewPanel`) and art (`badges`, `radar`, `pitch`, `stadium`). Helpers sit loose in `app/src` (`players.ts`, `bands.ts`, `matchday.ts`, `sorting.ts`). The market feature alone spans four files with no folder. Fix: feature folders (`market/`, `squad/`, `finance/`, `league/`) plus `ui/` and `art/`.
- [ ] **Two runtime import cycles.**
  - `persistence/src/index.ts` re-exports `store.ts`, which imports `readSave`/`wrapSave` back from `index.ts`. It works only through ESM hoisting. Fix: move the envelope into `envelope.ts`.
  - In `domain`, `foreign.ts` imports `COVER_AT_POSITION` from `market.ts`, while `market → state → foreign` closes the loop through types. Fix: move squad-shape constants into a lower module both can use.

### Scaffold follow-ups

- [ ] **Source comments still cite `CLAUDE.md`** as the record (`Explain.test.tsx`, `explain-topics.ts`, `calendar.test.ts`, `vitest.config.ts`). Repoint them to the doc that now holds each fact. Code was out of scope for the scaffold.
- [ ] **Pin GitHub Actions by commit SHA** instead of by tag. At the same time, restrict allowed actions to GitHub-owned plus `jdx/mise-action`, and turn on `sha_pinning_required`: `mise-action` runs in the deploy job, which holds `pages: write` and `id-token: write`. — security.md, `.github/workflows/ci.yml`
- [ ] **Decide on dependency update/audit tooling** (Dependabot, or `pnpm audit` in CI). Dependabot _alerts_ (not update PRs) are off and cost nothing; they don't conflict with "bumps are deliberate commits", and they would have flagged the vitest/undici advisories in August. — security.md

## Done

- [x] 2026-10-06: The README's What's new is v0.8.1.
- [x] 2026-10-06: Offers for your players lapse when the window closes, come only from a club that can pay the fee and bonus without borrowing, and re-check the window and the buyer on acceptance.
- [x] 2026-10-06: Saves are checked on load (whole-number version, uint32 rng state, `isGameState` payload), the save list says when one cannot be read, and a crash screen offers a reload or deleting the save.
- [x] 2026-10-06: The table's matchday is the round about to be played, the same as the hub's.
- [x] 2026-10-06: The results grid and Squad no longer scroll sideways at 390, 500, 700 or 850px in the built game, even with the `.screen { position: relative }` rule removed: the one shell (ADR 0022) took the cause away. Closed with no change.
- [x] 2026-10-06: Maturity assessment — verdict Ready to advertise, 0 gaps added to Open (the two soft spots are already Open items).
- [x] 2026-10-05: The README's What's new is v0.8.0.
- [x] 2026-10-05: Club ratings re-ranked from the league's results (ADR 0025): the same twenty rating pairs handed out by goal difference per match over 2025–26 and 2026–27, so Barcelona leads (89/87) and Madrid follows (87/88). Newcomers who were already in the foreign league take that row's value, so Rodri arrives at Barcelona as its third midfielder. `TEST_CLUBS` stays frozen at the August league.
- [x] 2026-10-05: The hub's art is back. Each place wears its old section's colour (Lliga green, Equip blue, Mercat brick, Club amber) on its rail marker and lit segment, at AA; on the desk the place's member of staff stands at the foot of the rail and all four line the foot of Avui's standing panel.
- [x] 2026-10-05: The squads refreshed after the summer window (ADR 0024), from Wikipedia (CC BY-SA): 56 newcomers with altered surnames, 7 moves between the game's clubs carried with their rows, departures and loans out dropped. The formation harness measures a frozen snapshot of the August rosters instead of the shipped ones.
- [x] 2026-10-05: Checks in a real browser (ADR 0023). Playwright runs every story at 390, 768 and 1280 for sideways scroll, contrast, edge padding and touch targets; screenshots the design system's stories against references made on Linux in CI; and smoke-tests the built game from a new career to a reload. A `browser` CI job runs them and releases wait for it. The first run found two desk bugs, both fixed: the player's status line against its panel's edge, and squad columns off the edge at tablet width.
- [x] 2026-10-05: One game at every width (ADR 0022, P20 rewritten). The phone's shell is the only shell: the desk gets the same bar (place, window chip, news, the game menu inline), the same five places as a rail, the same segments and the same day's action with the result sheet. Avui is home on both, and the quadrant hub retires. Listing a player from his card and clearing the market's filters work at every width. The results' grid tab is "Quadre", no longer a second "Resultats". `parity.test.tsx` requires the same controls on every screen at both widths.
- [x] 2026-10-05: Storybook in levels (ADR 0021). Foundations (colour with each ink's contrast, type, space and radius, icons, all read from `tokens.json` and the icon sets), primitives and components join the screens, 55 stories in all, each component on the surface it is drawn for. `tokens:build` also writes the swatch stylesheet the foundations use, guarded by the drift test, and every design-system story renders under Vitest.
- [x] 2026-10-05: Rows, filters and icons. On a phone tables keep 12px off the panel edge, the market cards are padded and their names no longer squeezed by the buttons, the squad drops its number column and the calendar its round so worth and result stay on screen. The market's filters and order open in sheets from one row (Filtres (n), Ordre), which brings back sorting on a phone. Every recurring verb has a glyph before its word on both layouts (`Button icon`, 10 new glyphs). The calendar's event rows are no longer 10px text. A padding audit (nothing within 8px of a panel edge), the contrast audit and the overflow check are clean at 390.
- [x] 2026-10-05: Text contrast. An audit of every text element on every screen and dialog at 390, 768 and 1280 found 13 pairs below WCAG AA, now none. Dialog bodies are screen material (their fields, notes and lists were drawn for it and read at 1.6:1 on the panel: the faint news, saves and explanations). `ink-soft` darkened to `#454b41` (4.76:1 on the panel, was 4.22); new `relegation-ink` and `ucl-ink` for red and blue as text on the screen (were 3.45 and 3.75); the Seguiment tiles' green darkened to 4.66:1 (was 3.54); the build stamp lost its fade (was 4.01).
- [x] 2026-10-05: Phone polish. The club picker's whole row is the button (a stretched pseudo-element missed taps on iOS). The page behind a dialog no longer scrolls, and every dialog renders into `body`, so the saves no longer draw under the action bar. Lists and forms (saves, news, explanations, bid, renew) open full-screen on a phone with a close button; questions stay sheets. Menus close on an outside press or Escape (`useDismiss`), which also fixes the desk language menu. The phone bar has a news button with the unread count, on every screen; Today shows the latest three lines. Partides and Surt have icons. A full-screen dialog's last row of buttons is pinned to the bottom of a phone screen, with the × kept at the top. The phone shell's segments carry their hub tile's icon above the label, and the market's tabs carry theirs. Double-tap zoom is off and fields are 16px on touch screens, so nothing zooms by accident; pinch-zoom stays.
- [x] 2026-10-05: Releases are tagged, and only releases deploy (ADR 0020). Merging to `main` runs `check` only; publishing a GitHub release (`v*` tag) checks and deploys it, and the footer shows the version. The README's What's new is now the latest release plus a link to the releases page, which closes the stale-changelog gap (C16) from the maturity check.
- [x] 2026-10-05: Maturity assessment — verdict Ready to advertise, 1 gap added to Open.
- [x] 2026-10-05: The phone shell (ADR 0019). A one-line bar with a ⋯ menu, an action bar with the day's action on every screen (play the match from anywhere, with the result in a sheet), and five tabs with icons and words. The phone hub (Today) leads with the next match, the round and the board's target. The table keeps points on screen; the market shows cards with what needs you first; the squad's sale and renew move to the player page, whose actions now come straight after the header; the bench opens as a sheet from the pitch, whose discs grow past 24px; the club picker is tappable rows. Signing, accepting an offer, stadium works, taking a club and a new career over a live one now ask first, with the numbers; a formation press offers undo; "bid again" can no longer lose the old bid (`dispatchAll`). New design-system parts: `Icon`, `TabBar`, `Segments`, `Confirm`, `Toast`; every dialog rises from the bottom on a phone. The desk is byte-identical at 1280 in the full-game screenshot comparison.
- [x] 2026-10-05: The language control is a button that reads the language in use (CA ▾) instead of a cog that rendered as an unreadable blob at 18px; the menu is unchanged. Its accessible name is the code and "Language", and the bar keeps its height: the full-game screenshots differ from `main` only in the bar's row on the desk and in the button on the phone.
- [x] 2026-10-04: The game on a phone (ADR 0018, P20). Below 40rem the shell becomes a document that scrolls, the bar takes two lines, and the footer is one sticky row with save, saves and quit behind More. The hub is one column and the club picker two-line rows; every control is at least 24px to press on a phone or any touch screen. The tablet hub fits its budget and its news heading. No screen scrolls sideways at 390, 768 or 1280, the desk is byte-identical at 1280 in the full-game screenshot comparison, and a test keeps media queries to the agreed set. Storybook 10 (ADR 0017) shows every screen from a seeded career at phone, tablet and desk width and in three languages; every story also runs under Vitest, and CI builds it. The Design System artifact was published to claude.ai.
- [x] 2026-10-04: `@fm/design-system`, a fifth package holding the game's look for the app and for a Claude Design System artifact (ADRs 0014–0016, P11 amended to allow the side branch). `tokens.json` is the source of truth and generates `tokens.css` (16 new tokens for values that were hardcoded, all at identical values). The reset and chrome stylesheets, eight shared components 21 React wrappers for the chrome primitives, and eight components that read the store or the dictionaries (now plain props, with thin adapters in the app) moved in, and every screen uses the wrappers. `pnpm build` also emits an IIFE bundle (React inlined, checked for imports, network and `</script`), `bundle.css` and `index.d.ts`. Brand assets are copied with a drift test, and every component has a README, a preview (all 37 render from the bundle in headless Chrome) and a test. Every step was checked against 34 screenshots of the whole game at 1280 and 390 wide, byte-identical to `main`.
- [x] 2026-10-04: Foreign clubs renew the contracts of players they keep at the rollover, as home clubs do, through one shared `renewedContract`. Lapsed foreign contracts had priced players at 0: in the audit's Málaga career 388 of 758 foreign players were signable for a fee of 1 by 2029, and now none is. Renewal lengths abroad draw from their own derived stream, so the recruits and the main stream are untouched and `pnpm season` is byte-identical. The foreign harness now asserts no club player at home or abroad opens a season on a lapsed contract (it failed before the fix). Existing saves heal at their next rollover.
- [x] 2026-10-04: Reducer refusals and security quick wins from the 2026-10-03 audit. The reducer now refuses: a contract the seller can no longer spare (stacked bids stripped AI squads and crashed the next signing), lineups and tactics for any club but the manager's, formations off the menu or with mismatched banks, `AdvanceDay` after the last matchday, `StartNewSeason` for a sacked manager or with an empty name pool, and fractional seats. Stadium expansion checks the bare cost, without a transfer's signing bonus. A second bid on the same day gets its own id. New tests for `SetTactics` and `SetTicketPrice` bounds; every new refusal test fails on the old code. `pnpm season` is byte-identical. CI declares `contents: read`; `pnpm dev` binds to localhost (`dev:lan` for the network); Vitest 4.1.11 and a lockfile refresh clear all 16 dev-dependency advisories. On GitHub, private vulnerability reporting is on and a "Protect main" ruleset blocks force-push and deletion and requires `check`, with admin bypass.
- [x] 2026-10-03: Architecture review (cohesion, modularity, layers, coupling). 12 items added under Open › Architecture review 2026-10-03, and the audit's oversized-modules item was folded into them.
- [x] 2026-10-03: Project audit (game model, UI and accessibility, code health, security and dependencies). 35 items added under Open › Audit 2026-10-03; 5 existing items updated with new detail.
- [x] 2026-10-03: The landing page's settings cog moves to the top-left corner once the page stacks, so it no longer covers the wordmark at 820–900px. A row of its own was rejected because it pushed the buttons below the fold at 820×600. The share card is verified live: Facebook, X, Slack, WhatsApp, LinkedIn, Telegram and Discord crawlers all get the page, 13 og tags and the 1200×630 JPEG, and opengraph.xyz renders the card.
- [x] 2026-10-02: Advertising-readiness fixes. The stacked landing page no longer lets the cover overlap the tagline and buttons (checked at 900×650, 820×600 and a 390px phone). Added a favicon (an SVG plus `.ico`) and an apple-touch-icon, guarded by `meta.test.ts`. package.json metadata, and the GitHub repo's description, website and topics. The README gained a cover image, badges, a What's new section and a Contributing section saying contributions are not accepted.
- [x] 2026-10-02: Maturity assessment. Verdict: Ready after blockers. 8 gaps added to Open.
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
