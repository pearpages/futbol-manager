import { describe, expect, it } from 'vitest'
import { FIXTURES_PER_ROUND } from './fixtures.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'
import { type Event, reduce } from './reduce.ts'
import { createRng } from './rng.ts'
import { newSeason, simulateSeason } from './simulate.ts'
import { type GameState, isSeasonComplete } from './state.ts'
import { addDays } from './time.ts'

const clubs = TEST_CLUBS

const fresh = (): GameState => newSeason(clubs, 2026, { names: TEST_NAMES, rng: createRng(11) })
const tick = (state: GameState, seed = 1) => reduce(state, { type: 'AdvanceDay' }, createRng(seed))
const kinds = (events: readonly Event[]) => events.map((e) => e.type)

describe('reduce · AdvanceDay', () => {
  it('resolves every fixture scheduled for today', () => {
    const { state, events } = tick(fresh())

    expect(events.filter((e) => e.type === 'MatchPlayed')).toHaveLength(FIXTURES_PER_ROUND)
    expect(state.season.fixtures.filter((f) => f.result !== null)).toHaveLength(FIXTURES_PER_ROUND)
    expect(state.season.fixtures.filter((f) => f.round === 1 && f.result === null)).toHaveLength(0)
  })

  it('advances the day clock by exactly one', () => {
    const before = fresh()
    const { state, events } = tick(before)

    expect(state.season.currentDate).toBe(addDays(before.season.currentDate, 1))
    expect(events.at(-1)).toEqual({ type: 'DayAdvanced', date: state.season.currentDate })
  })

  it('emits only DayAdvanced on a day with no fixtures', () => {
    const afterMatchday = tick(fresh()).state
    expect(kinds(tick(afterMatchday).events)).toEqual(['DayAdvanced'])
  })

  it('never mutates the state it is given', () => {
    const before = fresh()
    // JSON rather than structuredClone: `domain` has no DOM or Node lib by design,
    // and this is the same serialisation the save path uses anyway.
    const snapshot = JSON.parse(JSON.stringify(before)) as GameState
    tick(before)
    expect(before).toEqual(snapshot)
  })

  it('does not replay a fixture that already has a result', () => {
    // Guards a whole class of day-pipeline bug at M6: if a tick ever ran twice for
    // the same date, scores must not change.
    const once = tick(fresh()).state
    const rewound: GameState = {
      ...once,
      season: { ...once.season, currentDate: fresh().season.currentDate },
    }
    const { events, state } = tick(rewound, 999)

    expect(events.filter((e) => e.type === 'MatchPlayed')).toHaveLength(0)
    expect(state.season.fixtures.map((f) => f.result)).toEqual(
      once.season.fixtures.map((f) => f.result),
    )
  })

  it('resolves fixtures the clock has already passed', () => {
    // An exact date match would silently drop these forever. Anything that jumps
    // the clock hits this — "continue to next match" is a standard manager
    // feature, and postponements arrive at M7.
    const start = fresh()
    const jumped: GameState = {
      ...start,
      season: { ...start.season, currentDate: addDays(start.season.currentDate, 21) },
    }

    const { state, events } = tick(jumped)

    // Rounds 1–4 are all due by day 21 (one round per week), so all forty play.
    expect(events.filter((e) => e.type === 'MatchPlayed')).toHaveLength(FIXTURES_PER_ROUND * 4)
    expect(state.season.fixtures.filter((f) => f.round <= 4 && f.result === null)).toHaveLength(0)
    expect(state.season.fixtures.filter((f) => f.round === 5 && f.result !== null)).toHaveLength(0)
  })

  it('emits SeasonEnded exactly once, on the final matchday', () => {
    let state = fresh()
    const rng = createRng(7)
    let endings = 0

    for (let day = 0; day < 400; day++) {
      const result = reduce(state, { type: 'AdvanceDay' }, rng)
      state = result.state
      endings += result.events.filter((e) => e.type === 'SeasonEnded').length
    }

    expect(isSeasonComplete(state)).toBe(true)
    expect(endings).toBe(1)
  })
})

describe('determinism', () => {
  it('produces an identical season from the same seed', () => {
    const a = simulateSeason(fresh(), createRng(42))
    const b = simulateSeason(fresh(), createRng(42))
    expect(a).toEqual(b)
  })

  it('produces a different season from a different seed', () => {
    const a = simulateSeason(fresh(), createRng(1))
    const b = simulateSeason(fresh(), createRng(2))
    expect(a.season.fixtures.map((f) => f.result)).not.toEqual(
      b.season.fixtures.map((f) => f.result),
    )
  })
})

describe('simulateSeason', () => {
  it('plays all 380 fixtures', () => {
    const done = simulateSeason(fresh(), createRng(3))
    expect(done.season.fixtures.filter((f) => f.result !== null)).toHaveLength(380)
    expect(isSeasonComplete(done)).toBe(true)
  })

  it('catches up a season whose clock has run ahead', () => {
    // Previously this state was unfinishable: an exact date match skipped every
    // fixture the clock had passed. Now they are all simply due.
    const behind = fresh()
    const jumped: GameState = {
      ...behind,
      season: { ...behind.season, currentDate: addDays(behind.season.currentDate, 100_000) },
    }
    expect(isSeasonComplete(simulateSeason(jumped, createRng(1)))).toBe(true)
  })

  it('throws rather than looping forever if a fixture can never be reached', () => {
    // The remaining unreachable case: a fixture dated beyond the day ceiling.
    // The guard exists so a scheduling bug fails loudly instead of hanging.
    const broken = fresh()
    const [first, ...rest] = broken.season.fixtures
    /* c8 ignore next */
    if (first === undefined) throw new Error('no fixtures')

    const unreachable: GameState = {
      ...broken,
      season: {
        ...broken.season,
        fixtures: [{ ...first, date: addDays(first.date, 5_000) }, ...rest],
      },
    }
    expect(() => simulateSeason(unreachable, createRng(1))).toThrow(/did not complete/)
  })
})
