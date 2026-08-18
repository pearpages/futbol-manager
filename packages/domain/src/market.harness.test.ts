import { describe, expect, it } from 'vitest'
import { ageOn, overall, type Player } from './player.ts'
import { debtLimit, ledgerNet } from './finance.ts'
import { ROUNDS_PER_HALF } from './fixtures.ts'
import { bestXI, FORMATION_NAMES, startersOf } from './lineup.ts'
import { MAX_SQUAD, surplus, totalBudget } from './market.ts'
import { simulateCareer } from './simulate.ts'
import { computeTable } from './table.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'

/**
 * M4's exit criterion, as the roadmap words it: "sim ten seasons headless with no
 * human input; squads should still look reasonable and no club should own 40
 * players."
 *
 * This needs a **career**, not a sample. `simulateSeasons` runs independent
 * leagues — the right instrument for distribution bands, useless here, because a
 * squad cannot drift when it is rebuilt every August.
 *
 * Structural invariants first, and they are never to be loosened. A band moving
 * is a tuning problem; conservation failing is a bug.
 */

const SEASONS = 10
const SEED = 20260814

const career = simulateCareer(TEST_CLUBS, SEASONS, SEED, { names: TEST_NAMES })
const last = career.at(-1)
/* c8 ignore next */
if (last === undefined) throw new Error('career produced no seasons')

const squadsOf = (state: (typeof career)[number]['state']) =>
  state.clubs.map((club) => state.squads[club.id] ?? [])

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length

describe(`a ${SEASONS}-season career`, () => {
  it('plays every season to completion', () => {
    expect(career).toHaveLength(SEASONS)
    for (const run of career) {
      expect(run.state.season.fixtures.filter((f) => f.result !== null)).toHaveLength(380)
    }
  })

  it('advances a year at a time', () => {
    const years = career.map((r) => r.startYear)
    expect(years).toEqual(years.map((_, i) => (years[0] ?? 0) + i))
  })

  it('carries the same players forward rather than regenerating them', () => {
    // The thing that was missing before M4. Without it, "squads look reasonable
    // after ten seasons" is unmeasurable — they would be ten seasons old at most.
    const first = new Set((career[0]?.state.squads[TEST_CLUBS[0]?.id ?? ''] ?? []).map((p) => p.id))
    const later = career[3]?.state.squads[TEST_CLUBS[0]?.id ?? ''] ?? []
    const survivors = later.filter((p) => first.has(p.id))
    expect(survivors.length).toBeGreaterThan(5)
  })

  it('ages the players as the years pass', () => {
    // Free, because age derives from `birthDate` against the current date.
    //
    // **This asserted the club's *mean* age rising, and that was a proxy that has
    // stopped being valid.** It held while the league was quietly shrinking:
    // releases outnumbered arrivals, so the survivors got older together. With
    // `topUp` replacing what leaks away the mean is flat — 26.6 in season one and
    // 26.1 in season ten — which is what a real division does, and a mean that
    // climbs every year is the failure M4a's retirement rule was written against.
    // The range is asserted separately, at 20 to 33 per club.
    //
    // So this is the claim the proxy stood for, stated directly: a man still in
    // the league is exactly as many years older as seasons have passed.
    const first = career[0]
    const last = career.at(-1)
    /* c8 ignore next */
    if (first === undefined || last === undefined) throw new Error('missing season')

    const before = new Map(
      first.state.clubs
        .flatMap((club) => first.state.squads[club.id] ?? [])
        .map((p) => [p.id, ageOn(p, first.state.season.currentDate)]),
    )
    const survivors = last.state.clubs
      .flatMap((club) => last.state.squads[club.id] ?? [])
      .filter((p) => before.has(p.id))

    expect(survivors.length).toBeGreaterThan(5)
    for (const player of survivors) {
      const then = before.get(player.id) ?? 0
      const now = ageOn(player, last.state.season.currentDate)
      expect(now - then, player.name).toBe(SEASONS - 1)
    }
  })
})

describe('structural invariants — never loosen these', () => {
  it('accounts for every unit of money it moves', () => {
    // **This replaced "money is conserved" at M5a**, and it is the stricter of
    // the two. Until revenue existed, `totalBudget` was constant for a whole
    // career and any drift meant a fee credited without being debited. Money now
    // enters and leaves, so constancy says nothing — but every movement is a
    // ledger line, and a club's balance must move by exactly what its ledger
    // says and by nothing else.
    //
    // Between two consecutive seasons of a career, three things happen: the
    // rollover awards prize money (landing in `lastLedger`, since it arrives in
    // the same step that clears `ledger`), the summer window trades, and the
    // season is played. So the change in balance is last season's prize plus
    // everything the new season's ledger recorded.
    //
    // The old test said the league had inflated. This one says which club, and
    // on which line.
    for (let i = 1; i < career.length; i++) {
      const before = career[i - 1]?.state
      const after = career[i]?.state
      /* c8 ignore next */
      if (before === undefined || after === undefined) throw new Error('missing season')

      for (const club of after.clubs) {
        const was = before.clubs.find((c) => c.id === club.id)
        /* c8 ignore next */
        if (was === undefined) throw new Error(`club vanished: ${club.id}`)

        const prize = ledgerNet(club.lastLedger) - ledgerNet(was.ledger)
        expect(club.budget - was.budget, `${club.id} in ${String(after.season.startYear)}`).toBe(
          prize + ledgerNet(club.ledger),
        )
      }
    }
  })

  it('leaves nobody past their overdraft limit', () => {
    // The M5a exit criterion, half of it: "no AI club goes bankrupt". Debt is
    // allowed and the limit is what bankruptcy means here.
    for (const run of career) {
      for (const club of run.state.clubs) {
        const limit = debtLimit(club, run.state.competition.clubIds.length, ROUNDS_PER_HALF)
        expect(club.budget, `${club.id} in ${String(run.state.season.startYear)}`).toBeGreaterThan(
          -limit,
        )
      }
    }
  })

  it('does not let the league total run away', () => {
    // The other half: "none accumulates an unspendable fortune". Revenue net of
    // wages should leave the league roughly where it started rather than
    // compounding — a total that multiplies over ten seasons is a broken economy
    // even when no individual club is bankrupt.
    const start = totalBudget(career[0]?.state ?? last.state)
    expect(totalBudget(last.state)).toBeGreaterThan(start * 0.4)
    expect(totalBudget(last.state)).toBeLessThan(start * 3)
  })

  it('keeps every squad able to field a legal XI, in every formation', () => {
    for (const run of career) {
      for (const squad of squadsOf(run.state)) {
        for (const formation of FORMATION_NAMES) {
          expect(() => startersOf(squad, bestXI(squad, formation))).not.toThrow()
        }
      }
    }
  })

  it('never lets a club own 40 players', () => {
    // The roadmap's words. Squad size is a consequence of need scores falling to
    // zero, not a hardcoded cap — a cap would hide the bug this is looking for.
    for (const run of career) {
      for (const squad of squadsOf(run.state)) {
        expect(squad.length).toBeLessThanOrEqual(MAX_SQUAD)
        expect(squad.length).toBeGreaterThanOrEqual(18)
      }
    }
  })

  it('never loses or duplicates a player', () => {
    for (const run of career) {
      const all = squadsOf(run.state).flat()
      expect(new Set(all.map((p) => p.id)).size).toBe(all.length)
    }
  })

  it('keeps every player under contract', () => {
    for (const run of career) {
      for (const squad of squadsOf(run.state)) {
        for (const player of squad) {
          expect(player.contract.until).toBeGreaterThan(run.state.season.currentDate - 400)
        }
      }
    }
  })
})

describe('the league does not leak players', () => {
  const pool = career.map((run) => run.state.freeAgents.length)
  const listed = career.map((run) =>
    run.state.clubs.reduce((n, club) => n + surplus(run.state.squads[club.id] ?? []).length, 0),
  )

  it('keeps a market worth reading, rather than one that thins every year', () => {
    // **The defect this was written for, and nothing could see it.** Retirement is
    // replaced one-for-one and a transfer is neutral across the league, but a
    // release is not: a player nobody re-signs ages in the pool and retires *out of
    // the game*, with nothing generated in his place. Squads settled at 18.9
    // against a release floor of 21, and over twenty seasons the league fell from
    // 460 players to 380 and was still falling. That is what "there are always the
    // same players" actually was.
    //
    // **The band is on what is for sale, not on the head count**, and that is not a
    // stylistic choice: measured over these ten seasons the population reads 0.924
    // of its opening figure both with the fix and without it, because unsigned
    // players sit in the pool and are counted while the clubs empty out. What
    // separates the two is what a manager can actually buy — **150 at the worst
    // with `topUp`, 97 without it**, on the way to 60 by season twenty.
    expect(Math.min(...listed.slice(2))).toBeGreaterThan(130)
  })

  it('bounds the free-agent pool at both ends', () => {
    // There has always been a band on this being too *small* — deleting the
    // unsigned each summer drained it to nothing by season six — and none at all on
    // it being too large, which is how a pool that only grew came to ship.
    //
    // The two ends need different windows. Emptying shows up immediately, so the
    // floor is asserted every season. Growth is a **trend**, and it has to be
    // stated as one: at ten seasons the peaks are indistinguishable (51 against
    // 54), and a fixed ceiling would be measuring trade volume as much as the
    // patience rule — raising the AI's signing rate moved the observed maximum
    // from 15 to 38 without the rule changing at all. What does separate them is
    // the shape: the pool peaks early, as the first cohorts of released players
    // arrive, and then settles **below** that peak. Without the rule it climbs
    // past it and keeps going — measured at 50, 57, 76, 97 and still rising.
    for (const [season, size] of pool.entries()) {
      if (season < 2) continue
      expect(size, `season ${String(season + 1)}`).toBeGreaterThan(0)
    }
    const peak = Math.max(...pool.slice(0, 5))
    expect(mean(pool.slice(-3))).toBeLessThan(peak)
  })
})

describe('the league still looks like a league', () => {
  it('does not age into a retirement home or a nursery', () => {
    for (const run of career) {
      for (const squad of squadsOf(run.state)) {
        const age = mean(squad.map((p: Player) => ageOn(p, run.state.season.currentDate)))
        expect(age).toBeGreaterThan(20)
        expect(age).toBeLessThan(33)
      }
    }
  })

  it('keeps strong clubs strong — no runaway, no inversion', () => {
    // The drift test, and the point of the milestone. After a decade the pecking
    // order should still broadly hold: budgets are seeded from rating, so a market
    // that let the poorest club outbid the richest would invert the table.
    const finalTable = computeTable(last.state.competition.clubIds, last.state.season.fixtures)
    const positionOf = (id: string) => finalTable.findIndex((r) => r.clubId === id) + 1

    const topFive = TEST_CLUBS.slice(0, 5).map((c) => positionOf(c.id))
    const bottomFive = TEST_CLUBS.slice(-5).map((c) => positionOf(c.id))
    expect(mean(topFive)).toBeLessThan(mean(bottomFive))
  })

  it('does not concentrate all the talent in one club', () => {
    const squads = squadsOf(last.state)
    const strength = squads.map((squad) => mean(squad.map((p) => overall(p))))
    const best = Math.max(...strength)
    const worst = Math.min(...strength)
    // A runaway would show as one club far above a flattened field.
    expect(best - worst).toBeLessThan(45)
  })

  it('is deterministic — the same seed replays the same decade', () => {
    const repeat = simulateCareer(TEST_CLUBS, 3, SEED, { names: TEST_NAMES })
    const tableOf = (run: (typeof repeat)[number]) =>
      computeTable(run.state.competition.clubIds, run.state.season.fixtures)
    expect(repeat.map(tableOf)).toEqual(career.slice(0, 3).map(tableOf))
  })
})
