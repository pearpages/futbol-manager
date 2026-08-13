import type { ClubId, FixtureId, Score } from './entities.ts'
import { resolveFixture } from './resolve.ts'
import type { Rng } from './rng.ts'
import { type GameState, isSeasonComplete } from './state.ts'
import { addDays, type DayNumber } from './time.ts'

/**
 * The only way state changes — ground rule 2.
 *
 * `reduce` is pure: it takes state, a command and an rng, and returns new state
 * plus the events that describe what happened. It never mutates its input and
 * never reads a clock. The UI dispatches commands and renders from events; the
 * statistical harness drives the exact same door, which is the point — a
 * regression net only covers what it actually exercises.
 *
 * One command today. M6 grows the `AdvanceDay` handler into the day pipeline the
 * roadmap sketches — `[ageAndContracts, injuries, training, morale, aiTransfers,
 * playMatches, finances]` — by inserting pure functions in front of the existing
 * match resolution, not by restructuring this.
 */

export interface AdvanceDay {
  readonly type: 'AdvanceDay'
}

export type Command = AdvanceDay

export interface MatchPlayed {
  readonly type: 'MatchPlayed'
  readonly fixtureId: FixtureId
  readonly round: number
  readonly homeId: ClubId
  readonly awayId: ClubId
  readonly score: Score
}

export interface DayAdvanced {
  readonly type: 'DayAdvanced'
  readonly date: DayNumber
}

export interface SeasonEnded {
  readonly type: 'SeasonEnded'
  readonly startYear: number
}

export type Event = MatchPlayed | DayAdvanced | SeasonEnded

export interface ReduceResult {
  readonly state: GameState
  readonly events: readonly Event[]
}

export function reduce(state: GameState, command: Command, rng: Rng): ReduceResult {
  switch (command.type) {
    case 'AdvanceDay':
      return advanceDay(state, rng)
  }
}

function advanceDay(state: GameState, rng: Rng): ReduceResult {
  const today = state.season.currentDate
  const wasComplete = isSeasonComplete(state)
  const events: Event[] = []

  // Resolve everything scheduled for today. Fixtures are walked in stored order so
  // that rng draws happen in a fixed sequence — the same seed must always produce
  // the same season.
  const played = state.season.fixtures.map((fixture) => {
    if (fixture.date !== today || fixture.result !== null) return fixture

    const score = resolveFixture(rng)
    events.push({
      type: 'MatchPlayed',
      fixtureId: fixture.id,
      round: fixture.round,
      homeId: fixture.homeId,
      awayId: fixture.awayId,
      score,
    })
    return { ...fixture, result: score }
  })

  const next: GameState = {
    ...state,
    season: {
      ...state.season,
      currentDate: addDays(today, 1),
      fixtures: played,
    },
  }

  events.push({ type: 'DayAdvanced', date: next.season.currentDate })

  // Emitted once, on the transition — not on every subsequent day.
  if (!wasComplete && isSeasonComplete(next)) {
    events.push({ type: 'SeasonEnded', startYear: next.season.startYear })
  }

  return { state: next, events }
}
