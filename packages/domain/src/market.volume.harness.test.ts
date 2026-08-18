import { describe, expect, it } from 'vitest'
import { applyTransfers, runTransferWindow } from './market.ts'
import { rolloverSeason } from './season.ts'
import { createRng } from './rng.ts'
import { newSeason, simulateSeason } from './simulate.ts'
import type { GameState } from './state.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'

/**
 * **How much business the league actually does** — the one thing about the market
 * nothing has ever asserted.
 *
 * The project has been counting "clubs selling in a window" **by hand** at every
 * change that could move it — 6, then 8, then 9, then 7 — and `market.human.test.ts`
 * has had to re-pick its subject club four times because of it. Every other property
 * of the market has a band and this did not, which is how the division came to do
 * about nine deals a season between twenty clubs without anyone noticing.
 *
 * Its own file, at module scope, so the career runs once in its own worker — the
 * pattern `simulate.formations.harness.test.ts` set.
 *
 * **The bands here are tighter than this project's usual, and deliberately so.**
 * Elsewhere a band is a wide net around a statistical claim. This file is the
 * calibration instrument for deal volume, and a net loose enough to be comfortable
 * is a net that cannot see either of the two levers being removed — checked, not
 * assumed: at `mean(deals) > 10` both mutations passed. The run is a single fixed
 * seed, so there is no run-to-run noise to leave room for; anything that moves
 * these is a change to the model, which is exactly what should trip them.
 *
 * Measured over this career, with each lever removed on its own:
 *
 * | variant                        | deals | sellers |
 * | ------------------------------ | ----- | ------- |
 * | both (shipped)                 |  18.0 |    10.2 |
 * | flat `VALUE_FOR_MONEY`         |  11.2 |     7.2 |
 * | one paid signing for everybody |  12.7 |     7.6 |
 * | neither — the market as it was |   9.2 |     5.7 |
 *
 * Retune the model when one moves; never widen a band.
 */

const SEASONS = 12
const SEED = 20260814

interface Window {
  readonly deals: number
  readonly paid: number
  readonly sellers: number
  readonly buyers: number
  readonly mostByOneClub: number
}

const rng = createRng(SEED)
let state: GameState = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng })
const opening = new Map(
  TEST_CLUBS.map((club) => [club.id, new Set((state.squads[club.id] ?? []).map((p) => p.id))]),
)
const windows: Window[] = []

for (let season = 0; season < SEASONS; season++) {
  const transfers = runTransferWindow(state, rng)
  state = applyTransfers(state, transfers)

  const byBuyer = new Map<string, number>()
  for (const transfer of transfers) {
    byBuyer.set(transfer.to, (byBuyer.get(transfer.to) ?? 0) + 1)
  }
  windows.push({
    deals: transfers.length,
    paid: transfers.filter((t) => t.from !== null).length,
    sellers: new Set(transfers.map((t) => t.from).filter((from) => from !== null)).size,
    buyers: byBuyer.size,
    mostByOneClub: Math.max(0, ...byBuyer.values()),
  })

  state = simulateSeason(state, rng)
  if (season < SEASONS - 1) state = rolloverSeason(state, rng, { names: TEST_NAMES })
}

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length

describe(`business done over ${SEASONS} seasons`, () => {
  it('trades enough that the shop window is different each summer', () => {
    // **The complaint this was written for: "there are always the same players."**
    // The whole division did a mean of 9.2 transfers a season — a club bought
    // somebody roughly every other year, so a manager who looked at the market
    // twice saw the same names. It is 18.0 now.
    //
    // Fifteen is the floor because it is the only one that separates *both*
    // levers: removing either on its own still leaves 11.2 or 12.7.
    expect(mean(windows.map((w) => w.deals))).toBeGreaterThan(15)
    expect(mean(windows.map((w) => w.deals))).toBeLessThan(45)
  })

  it('never goes quiet, in any single window', () => {
    // A mean hides a market that stalls for a season, which is precisely what a
    // player would notice.
    for (const [season, window] of windows.entries()) {
      expect(window.deals, `season ${String(season + 1)}`).toBeGreaterThan(2)
    }
  })

  it('spreads the business across the league rather than through two clubs', () => {
    // Both halves matter. Enough clubs must be involved for the market to look
    // alive, and no single club may take the pick of it in one pass — which is
    // what the rotating serving order and the per-club cap are both for.
    // Nine sellers is the second figure that separates both levers on its own —
    // 7.2 and 7.6 with either removed, 5.7 with both. Buyers is deliberately
    // looser: it barely moves when the paid allowance is cut, because the same
    // clubs still shop, they just stop twice.
    expect(mean(windows.map((w) => w.sellers))).toBeGreaterThan(9)
    expect(mean(windows.map((w) => w.buyers))).toBeGreaterThan(5)
    expect(Math.max(...windows.map((w) => w.mostByOneClub))).toBeLessThanOrEqual(3)
  })

  it('keeps paid transfers the bulk of it, not free agents', () => {
    // A free agent is always better value than a man with a price on his head, so
    // this is the balance M4c had to build two separate counters to protect. If
    // free transfers ever dominate, the pool has been made too attractive again
    // and nobody will buy anybody.
    const paid = mean(windows.map((w) => w.paid))
    expect(paid / mean(windows.map((w) => w.deals))).toBeGreaterThan(0.6)
  })

  it('turns a squad over across a career', () => {
    // The player-facing form of the whole thing: how much of the squad you started
    // looking at is still there years later. Retirement and youth do most of this;
    // transfers are what make it feel like a market rather than a clock.
    const remaining = TEST_CLUBS.reduce((n, club) => {
      const now = state.squads[club.id] ?? []
      const then = opening.get(club.id)
      return n + now.filter((p) => then?.has(p.id) === true).length
    }, 0)
    const total = TEST_CLUBS.reduce((n, club) => n + (state.squads[club.id] ?? []).length, 0)

    expect(remaining / total).toBeLessThan(0.35)
  })
})
