import { describe, expect, it } from 'vitest'
import type { ClubId } from './entities.ts'
import { FINANCE } from './finance.ts'
import { FIXTURES_PER_ROUND } from './fixtures.ts'
import { bestXI, type Formation, worstXI } from './lineup.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'
import { type Command, type Event, reduce } from './reduce.ts'
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

    while (!isSeasonComplete(state)) {
      const result = reduce(state, { type: 'AdvanceDay' }, rng)
      state = result.state
      endings += result.events.filter((e) => e.type === 'SeasonEnded').length
    }

    expect(endings).toBe(1)
    expect(() => reduce(state, { type: 'AdvanceDay' }, rng)).toThrow(/season is over/)
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

/**
 * The commands a screen never sends wrong, and the reducer refuses anyway: P2
 * says validation lives here, because a screen can forget and this cannot.
 */
describe('reduce · SetLineup and SetTactics', () => {
  const managed = (state: GameState) => state.managedClubId
  const squadOf = (state: GameState) => state.squads[managed(state)] ?? []
  const rival = (state: GameState) => {
    const id = state.clubs.find((c) => c.id !== managed(state))?.id
    /* c8 ignore next */
    if (id === undefined) throw new Error('no rival')
    return id
  }
  const run = (state: GameState, command: Command) => reduce(state, command, createRng(1))

  it('sets the manager’s own XI and says so', () => {
    const state = fresh()
    const lineup = bestXI(squadOf(state), '4-3-3')
    const result = run(state, { type: 'SetLineup', clubId: managed(state), lineup })

    expect(result.state.lineups[managed(state)]).toEqual(lineup)
    expect(result.events).toEqual([{ type: 'LineupChanged', clubId: managed(state) }])
  })

  it('refuses another club’s team sheet', () => {
    const state = fresh()
    const theirs = rival(state)
    const lineup = worstXI(state.squads[theirs] ?? [], '4-4-2')

    expect(() => run(state, { type: 'SetLineup', clubId: theirs, lineup })).toThrow(
      expect.objectContaining({ code: 'error.club.notYours' }),
    )
  })

  it('refuses a club that does not exist', () => {
    const state = fresh()
    const lineup = bestXI(squadOf(state), '4-4-2')
    expect(() => run(state, { type: 'SetLineup', clubId: 'nobody' as ClubId, lineup })).toThrow(
      expect.objectContaining({ code: 'error.club.notYours' }),
    )
  })

  it('refuses a formation that is not on the menu', () => {
    const state = fresh()
    const lineup = { ...bestXI(squadOf(state), '4-4-2'), formation: '9-9-9' as Formation }

    expect(() => run(state, { type: 'SetLineup', clubId: managed(state), lineup })).toThrow(
      expect.objectContaining({ code: 'error.lineup.shape' }),
    )
  })

  it('refuses an XI whose banks do not match its own label', () => {
    // A legal eleven, one keeper, nobody twice, lined up 4-3-3 and called 4-4-2.
    const state = fresh()
    const lineup = { ...bestXI(squadOf(state), '4-3-3'), formation: '4-4-2' as Formation }

    expect(() => run(state, { type: 'SetLineup', clubId: managed(state), lineup })).toThrow(
      expect.objectContaining({ code: 'error.lineup.shape' }),
    )
  })

  it('takes the slider at both ends and says so', () => {
    const state = fresh()
    for (const attacking of [0, 100]) {
      const result = run(state, {
        type: 'SetTactics',
        clubId: managed(state),
        tactics: { attacking },
      })
      expect(result.state.tactics[managed(state)]).toEqual({ attacking })
      expect(result.events).toEqual([{ type: 'TacticsChanged', clubId: managed(state) }])
    }
  })

  it('refuses the slider past either end, and NaN', () => {
    const state = fresh()
    for (const attacking of [-1, 101, Number.NaN]) {
      expect(() =>
        run(state, { type: 'SetTactics', clubId: managed(state), tactics: { attacking } }),
      ).toThrow(expect.objectContaining({ code: 'error.tactics.range' }))
    }
  })

  it('refuses another club’s tactics', () => {
    const state = fresh()
    expect(() =>
      run(state, { type: 'SetTactics', clubId: rival(state), tactics: { attacking: 100 } }),
    ).toThrow(expect.objectContaining({ code: 'error.club.notYours' }))
  })
})

describe('reduce · SetTicketPrice', () => {
  const low = FINANCE.TICKET * FINANCE.MIN_TICKET_FACTOR
  const high = FINANCE.TICKET * FINANCE.MAX_TICKET_FACTOR
  const priceOf = (state: GameState) =>
    state.clubs.find((c) => c.id === state.managedClubId)?.ticketPrice

  it('takes either bound and says so', () => {
    for (const price of [low, high]) {
      const result = reduce(fresh(), { type: 'SetTicketPrice', price }, createRng(1))
      expect(priceOf(result.state)).toBe(price)
      expect(result.events).toEqual([{ type: 'TicketPriceSet', price }])
    }
  })

  it('refuses a price outside the bounds, and NaN', () => {
    for (const price of [low - 1, high + 1, Number.NaN]) {
      expect(() => reduce(fresh(), { type: 'SetTicketPrice', price }, createRng(1))).toThrow(
        expect.objectContaining({ code: 'error.ticket.range' }),
      )
    }
  })
})

describe('reduce · the end of a season', () => {
  const finished = () => simulateSeason(fresh(), createRng(3))

  it('refuses to roll over for a manager the board has sacked', () => {
    const done = finished()
    const sacked: GameState = { ...done, board: { ...done.board, sacked: true } }

    expect(() =>
      reduce(sacked, { type: 'StartNewSeason', names: TEST_NAMES }, createRng(1)),
    ).toThrow(expect.objectContaining({ code: 'error.career.over' }))
  })

  it('refuses an empty name pool rather than naming everyone "Youth Player"', () => {
    expect(() => reduce(finished(), { type: 'StartNewSeason', names: [] }, createRng(1))).toThrow(
      /name pool/,
    )
  })
})
