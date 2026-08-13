import { type ClubId, type FixtureId, type Score, type TeamRating } from './entities.ts'
import { BALANCED, type Lineup, startersOf, type Tactics, teamRating } from './lineup.ts'
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
 * M6 grows the `AdvanceDay` handler into the day pipeline the roadmap sketches — `[ageAndContracts, injuries, training, morale, aiTransfers,
 * playMatches, finances]` — by inserting pure functions in front of the existing
 * match resolution, not by restructuring this.
 */

export interface AdvanceDay {
  readonly type: 'AdvanceDay'
}

/** Rejected if the XI is illegal, so an invalid lineup can never reach a match. */
export interface SetLineup {
  readonly type: 'SetLineup'
  readonly clubId: ClubId
  readonly lineup: Lineup
}

export interface SetTactics {
  readonly type: 'SetTactics'
  readonly clubId: ClubId
  readonly tactics: Tactics
}

export type Command = AdvanceDay | SetLineup | SetTactics

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

export interface LineupChanged {
  readonly type: 'LineupChanged'
  readonly clubId: ClubId
}

export interface TacticsChanged {
  readonly type: 'TacticsChanged'
  readonly clubId: ClubId
}

export type Event = MatchPlayed | DayAdvanced | SeasonEnded | LineupChanged | TacticsChanged

export interface ReduceResult {
  readonly state: GameState
  readonly events: readonly Event[]
}

export function reduce(state: GameState, command: Command, rng: Rng): ReduceResult {
  switch (command.type) {
    case 'AdvanceDay':
      return advanceDay(state, rng)
    case 'SetLineup':
      return setLineup(state, command)
    case 'SetTactics':
      return setTactics(state, command)
  }
}

function setLineup(state: GameState, command: SetLineup): ReduceResult {
  // Validated here rather than in the UI. A screen can forget; the reducer is the
  // only way in, so an illegal XI cannot reach a matchday through any other route.
  startersOf(state.squads[command.clubId] ?? [], command.lineup)

  return {
    state: { ...state, lineups: { ...state.lineups, [command.clubId]: command.lineup } },
    events: [{ type: 'LineupChanged', clubId: command.clubId }],
  }
}

function setTactics(state: GameState, command: SetTactics): ReduceResult {
  const attacking = command.tactics.attacking
  if (!Number.isFinite(attacking) || attacking < 0 || attacking > 100) {
    throw new Error(`Tactics must sit between 0 and 100, got ${attacking}`)
  }

  return {
    state: { ...state, tactics: { ...state.tactics, [command.clubId]: command.tactics } },
    events: [{ type: 'TacticsChanged', clubId: command.clubId }],
  }
}

function advanceDay(state: GameState, rng: Rng): ReduceResult {
  const today = state.season.currentDate
  const wasComplete = isSeasonComplete(state)
  const events: Event[] = []

  // Ratings come from each club's selected XI and tactics — the collapse specified
  // in docs/attribute-model.md. `resolveFixture` is unchanged from M2; M3 replaced
  // the supplier, not the signature, which is what the TeamRating parameter was for.
  const ratings = new Map<ClubId, TeamRating>(
    state.clubs.map((club) => {
      const squad = state.squads[club.id] ?? []
      const lineup = state.lineups[club.id]
      /* c8 ignore next */
      if (lineup === undefined) throw new Error(`No lineup selected for ${club.id}`)
      return [club.id, teamRating(startersOf(squad, lineup), state.tactics[club.id] ?? BALANCED)]
    }),
  )

  // Resolve everything *due* — not merely everything dated today. An exact date
  // match silently drops any fixture the clock has already passed, and anything
  // that jumps the clock produces exactly that: "continue to next match" is a
  // standard manager feature, and postponements arrive at M7.
  //
  // Fixtures are walked in stored order so rng draws happen in a fixed sequence —
  // the same seed must always produce the same season.
  const played = state.season.fixtures.map((fixture) => {
    if (fixture.date > today || fixture.result !== null) return fixture

    const home = ratings.get(fixture.homeId)
    const away = ratings.get(fixture.awayId)
    /* c8 ignore next */
    if (home === undefined || away === undefined) return fixture

    const score = resolveFixture(home, away, rng)
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
