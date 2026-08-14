# M4b handoff — the human in the transfer market

**Start a fresh session and say: "read docs/handoff-m4b.md".**

`CLAUDE.md` loads automatically in this repo and already carries the ground rules, stack, conventions and the full session log through M4a — so this document deliberately does _not_ repeat them. It carries only what a new session cannot infer: the API surface M4b builds on, the decisions that constrain it, and the traps that cost time getting here.

Delete this file once M4b is done; it is a handoff, not documentation.

**State:** `0410926` (`m4a: a transfer market that runs itself`). 246 tests green, typecheck/lint/format clean, working tree clean.

```bash
mise exec -- pnpm test -- --run     # 246 tests, 18 files
mise exec -- pnpm season            # headless season, prints the table
```

`node`/`pnpm` are not on PATH in non-interactive shells — mise's hook does not fire there. Prefix with `mise exec --`. In an interactive shell they work after `cd`.

---

## What M4b is

Bids and counter-bids, contract negotiation (wage, length, signing bonus), a transfer screen and a shortlist. The AI market already runs; this is the player's way into it.

**Exit criterion:** you can identify a weakness in your squad, buy a player to fix it, and see it change your results.

---

## Two things that will bite immediately

Both were found while writing this handoff. Neither is a bug _today_ — they are gaps M4b's first hour will hit.

**1. The AI currently runs the human's transfers.** `runTransferWindow` iterates every club in `state.clubs` with no filter on `managedClubId`. That is correct at M4a, where nobody is playing. The moment the human can bid, their club must be excluded or the AI will buy over the top of them.

**2. The UI cannot reach a second season.** `simulateCareer` does rollover, but it is headless-only. The store has no rollover path, so when the season ends `App.tsx` disables the button and shows "Season over" — permanently. Since transfer windows sit _between_ seasons, M4b almost certainly needs a `StartNewSeason` command wired through `reduce` and the store before a transfer screen is worth building.

---

## The surface M4b builds on

Everything below is exported from `@fm/domain`.

**Market — `packages/domain/src/market.ts`**

```ts
isTransferWindowOpen(date: DayNumber): boolean       // July, August, January
needFor(squad, candidate: Player): number            // the scoring function
surplus(squad): Player[]                             // who a club would sell
runTransferWindow(state, rng): Transfer[]            // AI business for one window
applyTransfers(state, transfers): GameState          // moves players AND money
totalBudget(state): number                           // the conservation invariant
MIN_SQUAD = 18, MAX_SQUAD = 30
interface Transfer { playerId, from, to, fee }
```

**Valuation — `packages/domain/src/valuation.ts`**

```ts
valuePlayer(player, date): number    // thousands. quality^3.2 x age x contract x scarcity
askingPrice(player, date): number    // valuePlayer x 1.35 — what a seller holds out for
expectedWage(player, date): number   // valuePlayer x 0.22, floor 50
```

**Season — `packages/domain/src/season.ts`**

```ts
rolloverSeason(state, rng, { names }): GameState   // ages, renews, retires, new fixtures
contractExpiry(year): DayNumber                    // 30 June
defaultSeasonStart(year): DayNumber                // 15 August
```

**State and commands**

```ts
GameState { clubs, competition, season, squads, lineups, tactics, managedClubId }
Club      { id, name, shortName, attack, defence, budget }
Player    { id, name, position, birthDate, attributes, contract: { until, wage } }

Command = AdvanceDay | SetLineup | SetTactics
Event   = MatchPlayed | DayAdvanced | SeasonEnded | LineupChanged | TacticsChanged
reduce(state, command, rng): { state, events }
```

**Store — `packages/app/src/store.ts`** (Zustand)
`game`, `screen`, `inspectedPlayerId`, `feed`, `saving`, `needsSetup`; `dispatch`, `go`, `inspect`, `save`, `restore`, `newGame`, `restart`. Screens: `table | squad | lineup | player`.

**Chrome primitives already in `packages/app/src/styles/chrome.css`** — reach for these before writing new CSS:
`.panel .panel__title .screen .screen__heading .screen__note .data-table .data-table__row .data-table__head .data-table__band .chip .stat .attr .button .field .swatch .visually-hidden`

Existing screens to copy patterns from: `TableScreen`, `SquadScreen`, `PlayerScreen` (the ficha), `LineupScreen`, `SetupScreen`.

---

## Decisions already made that constrain M4b

- **The market is a scoring function, never a rule tree.** Need = marginal gain in team rating. **Do not add rules capping goalkeepers or squad size** — a second keeper cannot enter the XI so his need is already zero, and squad size falls out of needs decaying. A cap hides the bug the exit criterion hunts for.
- **Money is conserved.** `totalBudget` is constant across a career — verified at 27,854k for ten seasons. A fee credited but not debited would inflate the league silently for years. Never loosen that test.
- **A goalkeeper is worth ~2.5× any other signing** (+10.5 league points vs +4.1 for a defender). `SCARCITY` in `valuation.ts` already prices it. If bidding logic bypasses `valuePlayer`, the human empties the league of keepers.
- **`docs/attribute-model.md` is the spec.** Changing the resolver contract means changing that document _first_.
- **Schema is v4.** Pending bids are state, so M4b likely means **v5 + a migration + a committed `fixtures/v4.json`** — `packages/persistence/src/migrations.ts`, and the fixture discipline is in ADR 0005.

---

## Traps that cost time this session

- **A test comparing a single stochastic run is luck, not evidence.** One app test compared two single seasons and asserted the better XI won more points — a ~7-point effect against ~7 points of season variance. It passed for two milestones, then an unrelated rng change broke it. Statistical claims go in the domain harness (20+ seasons); UI tests assert deterministic things.
- **Adding any `rng.next()` call shifts every downstream draw.** Squads, results, everything. Determinism holds, but values move — so anything pinned to a specific generated number will break.
- **Testing Library only auto-cleans with Vitest globals on, and they are off.** Already handled in `packages/app/src/test-setup.ts`; without it every `render` stacks into one document.
- **No JSX `style` prop, ever** — bar widths use bucketed `data-fill` attribute selectors. Relative imports carry `.ts`/`.tsx` extensions.
- **The harness runs every club on balanced tactics**, so it cannot see tactical exploits. Drive tactics explicitly if M4b touches them.
- **The UI has never been seen in a browser.** The Chrome extension failed to connect across three attempts, so every screen is verified by tests and DOM dumps only. Worth a `pnpm dev` early.
- **`.git/index.lock` intermittently blocks commits** — VS Code's git extension. It clears on its own; retry rather than deleting it.

---

## Suggested shape for M4b

1. Exclude `managedClubId` from `runTransferWindow`.
2. `StartNewSeason` command → `rolloverSeason`, so the UI can reach season two.
3. Pending bids in `GameState` + schema v5 + migration + `fixtures/v4.json`.
4. Commands: `MakeBid`, `WithdrawBid`, `OfferContract`. Validate in the reducer, as `SetLineup` does — a screen can forget, the reducer cannot.
5. AI responses to bids: accept above `askingPrice`, counter near it, reject when the player's `needFor` score at his current club is high.
6. Transfer screen + shortlist, reusing `.data-table` and `.screen`.
7. Harness: a career where the human's club buys sensibly still conserves money and does not break squad bounds.

**Verification:** existing 246 green and the M2/M3 bands _unchanged_; money conserved; a ten-season career still sane; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`; and actually run `pnpm dev`.
