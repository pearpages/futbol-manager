import { describe, expect, it } from 'vitest'
import { ageOn, overall, type Player } from './player.ts'
import { bestXI, FORMATION_NAMES, startersOf } from './lineup.ts'
import { MAX_SQUAD, totalBudget } from './market.ts'
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

  it('ages the league as the years pass', () => {
    // Free, because age derives from birthDate against the current date.
    const ageIn = (index: number) => {
      const run = career[index]
      /* c8 ignore next */
      if (run === undefined) throw new Error('missing season')
      const squad = run.state.squads[TEST_CLUBS[0]?.id ?? ''] ?? []
      return mean(squad.map((p) => ageOn(p, run.state.season.currentDate)))
    }
    expect(ageIn(SEASONS - 1)).toBeGreaterThan(ageIn(0))
  })
})

describe('structural invariants — never loosen these', () => {
  it('conserves money: a transfer moves it, nothing creates it', () => {
    // The single most valuable check here. A fee credited to a seller but not
    // debited from a buyer would inflate the league forever and show up as
    // nothing else until squads went strange years later.
    const start = totalBudget(career[0]?.state ?? last.state)
    for (const run of career) {
      expect(totalBudget(run.state)).toBeCloseTo(start, 6)
    }
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
