import { describe, expect, it } from 'vitest'
import {
  foreignMeanAge,
  foreignPlayers,
  generateForeignLeague,
  refreshForeignLeague,
} from './foreign.ts'
import { bestXI, FORMATION_NAMES, startersOf } from './lineup.ts'
import {
  applyTransfers,
  COVER_AT_POSITION,
  MAX_SQUAD,
  MIN_SQUAD,
  runTransferWindow,
  totalBudget,
} from './market.ts'
import { defaultSeasonStart, rolloverSeason } from './season.ts'
import { createRng } from './rng.ts'
import { newSeason, simulateSeason } from './simulate.ts'
import { POSITIONS } from './player.ts'
import type { GameState } from './state.ts'
import { TEST_CLUBS, TEST_FOREIGN_CLUBS, TEST_INTL_NAMES, TEST_NAMES } from './test-clubs.ts'

/**
 * A career **with** a market abroad.
 *
 * Every other harness in this package runs with none, which is deliberate and is
 * what keeps the calibrated M2/M3/M5 bands measuring the division they have always
 * measured. This file is where the foreign layer is held to the same standards,
 * plus the one property that is unique to it: **money crossing the border.**
 */

const SEASONS = 12
const SEED = 20260818
const FIRST_YEAR = 2026

const rng = createRng(SEED)
let state: GameState = newSeason(TEST_CLUBS, FIRST_YEAR, {
  names: TEST_NAMES,
  rng,
  foreign: generateForeignLeague(TEST_FOREIGN_CLUBS, FIRST_YEAR, {
    names: TEST_INTL_NAMES,
    seasonStart: defaultSeasonStart(FIRST_YEAR),
  }),
})

const openingLeagueTotal = totalBudget(state)
const openingAbroad = new Map(
  state.foreign.clubs.map((club) => [
    club.id,
    new Set((state.foreign.squads[club.id] ?? []).map((p) => p.id)),
  ]),
)
const openingDomestic = new Set(
  TEST_CLUBS.flatMap((club) => state.squads[club.id] ?? []).map((player) => player.id),
)
const states: GameState[] = []
/** Fees in minus fees out, from the domestic league's point of view. */
let crossBorderNet = 0

const domesticIds = new Set(TEST_CLUBS.map((club) => club.id))

for (let season = 0; season < SEASONS; season++) {
  const transfers = runTransferWindow(state, rng)
  for (const transfer of transfers) {
    const sellerIsHome = transfer.from !== null && domesticIds.has(transfer.from)
    const buyerIsHome = domesticIds.has(transfer.to)
    if (sellerIsHome && !buyerIsHome) crossBorderNet += transfer.fee
    if (!sellerIsHome && buyerIsHome && transfer.from !== null) crossBorderNet -= transfer.fee
  }
  state = applyTransfers(state, transfers)
  state = simulateSeason(state, rng)
  states.push(state)
  if (season < SEASONS - 1) {
    state = rolloverSeason(state, rng, { names: TEST_NAMES, foreignNames: TEST_INTL_NAMES })
  }
}

describe('a career with a market abroad', () => {
  it('trades across the border in both directions', () => {
    // If nothing moves, the layer is decoration. `crossBorderNet` being non-zero
    // is weaker than that — it only says *something* crossed — so this asserts the
    // squads themselves changed hands.
    const domesticNow = new Set(
      TEST_CLUBS.flatMap((c) => state.squads[c.id] ?? []).map((p) => p.id),
    )

    const boughtFromAbroad = [...openingAbroad.values()]
      .flatMap((ids) => [...ids])
      .filter((id) => domesticNow.has(id))
    expect(boughtFromAbroad.length).toBeGreaterThan(0)

    // **Both directions, and the second half is the one that needed saying.** This
    // asserted only that Spain had bought from abroad, which a foreign league that
    // never buys anything satisfies perfectly — the mutation stopping them buying
    // failed nothing at all.
    // Checked across the whole career, not only at the end: a man sold abroad can
    // later be churned out of that squad, so the final season alone can show none.
    const everAbroad = new Set(
      states.flatMap((run) => foreignPlayers(run.foreign).map((p) => p.id)),
    )
    const soldAbroad = [...openingDomestic].filter((id) => everAbroad.has(id))
    expect(soldAbroad.length).toBeGreaterThan(0)
  })

  it('does not drain or flood the league with foreign money', () => {
    // **The sharpest risk in the whole layer.** A sale abroad brings money in from
    // outside the ledger and a purchase takes it out, so a systematically richer or
    // stronger foreign league would be a one-way valve. Nothing enforces balance
    // directly; it holds because foreign clubs are seeded on the same rating and
    // budget curves as domestic ones and buy on the same score. **If this band
    // moves, that seeding is the lever — never the band.**
    // Measured at **−15k against a league holding ~400k**, under 4%. The cap on
    // how many players a foreign club offers is what buys that: at two it is
    // −128k, at three −206k, at five −287k, because these are the strongest clubs
    // in Europe and their need for a mid-table Spanish player is zero. See
    // `FOREIGN_LISTINGS`.
    expect(Math.abs(crossBorderNet)).toBeLessThan(openingLeagueTotal * 0.5)
  })

  it('keeps the domestic league total inside the band it has without a foreign market', () => {
    // The same 0.4–3.0 the ordinary career harness asserts, **and measured from
    // the same point it measures from**: the end of the first season, not the
    // moment before it. That distinction is not pedantry — season one alone takes
    // the league to 1.8× as seeded budgets meet a first year of revenue, so a band
    // anchored before it is a different band wearing the same numbers. Anchored
    // wrongly this failed at 3.1×, and the identical career **with no foreign
    // clubs at all** read 3.04× — the layer was never the cause.
    //
    // For the record, measured both ways over these twelve seasons: 3.04× without
    // a foreign market and 2.85× with one. It takes money *out* of the domestic
    // league on balance, which is the opposite of the risk this band exists for.
    const settled = states[0]
    /* c8 ignore next */
    if (settled === undefined) throw new Error('no seasons')
    const base = totalBudget(settled)

    for (const run of states) {
      expect(totalBudget(run)).toBeGreaterThan(base * 0.4)
      expect(totalBudget(run)).toBeLessThan(base * 3)
    }
  })

  it('keeps every foreign squad legal and the right size', () => {
    for (const run of states) {
      for (const club of run.foreign.clubs) {
        const squad = run.foreign.squads[club.id] ?? []
        expect(squad.length, club.id).toBeGreaterThanOrEqual(MIN_SQUAD)
        expect(squad.length, club.id).toBeLessThanOrEqual(MAX_SQUAD)
        for (const formation of FORMATION_NAMES) {
          expect(
            () => startersOf(squad, bestXI(squad, formation)),
            `${club.id} ${formation}`,
          ).not.toThrow()
        }
        // **Cover, not merely a legal XI**, and the distinction is exactly what
        // the churn gets wrong when it measures thinness by raw count: a squad
        // wants five midfielders and two keepers, so "fewest players" always
        // points at goalkeeper and never at the bank actually short. A club can
        // field every shape on one keeper and still be a squad nobody would run —
        // which is why that mutation slipped past the formation loop above.
        for (const position of POSITIONS) {
          expect(
            squad.filter((p) => p.position === position).length,
            `${club.id} ${position}`,
          ).toBeGreaterThanOrEqual(COVER_AT_POSITION[position])
        }
      }
    }
  })

  it('keeps the foreign squads the shape of squads', () => {
    // The half a cover floor cannot see. Measuring thinness by raw count sends
    // every replacement to goalkeeper — it is always the smallest bank — and so
    // does breaking a tie there, since cover is 2 at keeper and 5 everywhere else.
    // Both drift **every club to four keepers** over twelve refreshes while every
    // formation stays playable and every cover floor holds, so the band is on the
    // mean rather than on any single club.
    const last = states.at(-1)
    /* c8 ignore next */
    if (last === undefined) throw new Error('no seasons')
    const keepers = last.foreign.clubs.map(
      (club) => (last.foreign.squads[club.id] ?? []).filter((p) => p.position === 'GK').length,
    )
    const mean = keepers.reduce((a, b) => a + b, 0) / keepers.length
    expect(mean).toBeLessThan(3.5)
  })

  it('never loses or duplicates a player, at home or abroad', () => {
    for (const run of states) {
      const all = [
        ...TEST_CLUBS.flatMap((c) => run.squads[c.id] ?? []),
        ...foreignPlayers(run.foreign),
        ...run.freeAgents,
      ]
      expect(new Set(all.map((p) => p.id)).size).toBe(all.length)
    }
  })

  it('turns the foreign squads over, which is the point of them', () => {
    // **The answer to "there are always the same players", from abroad.** Without
    // churn the same seven hundred names sit there for the whole career.
    const now = new Set(foreignPlayers(state.foreign).map((p) => p.id))
    const survivors = [...openingAbroad.values()]
      .flatMap((ids) => [...ids])
      .filter((id) => now.has(id)).length
    const opening = [...openingAbroad.values()].reduce((n, ids) => n + ids.size, 0)

    expect(survivors / opening).toBeLessThan(0.5)
  })

  it('does not let the foreign league age or empty', () => {
    const age = foreignMeanAge(state.foreign, state.season.currentDate)
    expect(age).toBeGreaterThan(20)
    expect(age).toBeLessThan(33)
  })

  it('is deterministic — the same seed replays the same world', () => {
    const again = generateForeignLeague(TEST_FOREIGN_CLUBS, FIRST_YEAR, {
      names: TEST_INTL_NAMES,
      seasonStart: defaultSeasonStart(FIRST_YEAR),
    })
    const once = generateForeignLeague(TEST_FOREIGN_CLUBS, FIRST_YEAR, {
      names: TEST_INTL_NAMES,
      seasonStart: defaultSeasonStart(FIRST_YEAR),
    })
    expect(again).toEqual(once)

    const refreshed = refreshForeignLeague(once, FIRST_YEAR + 1, {
      names: TEST_INTL_NAMES,
      seasonStart: defaultSeasonStart(FIRST_YEAR + 1),
    })
    expect(refreshed).toEqual(
      refreshForeignLeague(once, FIRST_YEAR + 1, {
        names: TEST_INTL_NAMES,
        seasonStart: defaultSeasonStart(FIRST_YEAR + 1),
      }),
    )
  })

  it('draws nothing from the main generator', () => {
    // **The property the whole module is built around.** Seven hundred players
    // come off streams derived from the club id and the year, so building a world
    // cannot move a match result — which is why `pnpm season` never budged and no
    // distribution band had to be re-measured.
    //
    // Stated as a comparison rather than as "this generator did not move", which
    // was the first version and could not fail: it watched a generator nothing was
    // ever going to touch. Two `newSeason` calls on the same seed, one handed a
    // foreign league and one not, must leave the generator in the same place.
    const withWorld = createRng(4242)
    newSeason(TEST_CLUBS, FIRST_YEAR, {
      names: TEST_NAMES,
      rng: withWorld,
      foreign: generateForeignLeague(TEST_FOREIGN_CLUBS, FIRST_YEAR, {
        names: TEST_INTL_NAMES,
        seasonStart: defaultSeasonStart(FIRST_YEAR),
      }),
    })

    const without = createRng(4242)
    newSeason(TEST_CLUBS, FIRST_YEAR, { names: TEST_NAMES, rng: without })

    expect(withWorld.state()).toEqual(without.state())
  })
})
