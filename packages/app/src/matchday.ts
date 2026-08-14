import {
  bestXI,
  type Club,
  type Fixture,
  type GameState,
  nextFixtureFor,
  startersOf,
  teamRating,
} from '@fm/domain'

/**
 * What the manager needs to know about his next match, in one place.
 *
 * Both the shell bar and the hub ask the same questions, and the answers decide
 * what the primary button does — so this is a pure function either can call
 * rather than logic living in whichever component happened to need it first.
 */

export interface Matchday {
  readonly fixture: Fixture
  readonly opponent: Club | undefined
  readonly home: boolean
  /** Negative would mean overdue, which `advanceDay` makes impossible to sit on. */
  readonly daysAway: number
  /** True when the next tick will play it — the moment kicking off becomes a choice. */
  readonly due: boolean
}

export function matchdayFor(game: GameState): Matchday | null {
  const fixture = nextFixtureFor(game.season.fixtures, game.managedClubId)
  if (fixture === null) return null

  const home = fixture.homeId === game.managedClubId
  const opponentId = home ? fixture.awayId : fixture.homeId

  return {
    fixture,
    opponent: game.clubs.find((c) => c.id === opponentId),
    home,
    daysAway: fixture.date - game.season.currentDate,
    due: fixture.date <= game.season.currentDate,
  }
}

/** "v Sevilla (H)" — the shortest way to say who and where. */
export function describeOpponent(matchday: Matchday): string {
  return `v ${matchday.opponent?.name ?? '???'} (${matchday.home ? 'H' : 'A'})`
}

export interface WeakLineup {
  readonly current: number
  readonly best: number
}

/**
 * True when the stored XI is weaker than the strongest legal one.
 *
 * This exists because of a deliberate M4c decision: the reducer stopped
 * rebuilding the manager's team sheet behind his back, which is right — but it
 * means **signing a player no longer selects him**. Without a nudge, a manager
 * buys a goalkeeper and plays the old one, and nothing tells him.
 *
 * A warning, never a block. There is no fatigue or rotation yet, so a weaker XI
 * is almost certainly an oversight — but it is still his team.
 */
export function weakLineup(game: GameState): WeakLineup | null {
  const squad = game.squads[game.managedClubId] ?? []
  const lineup = game.lineups[game.managedClubId]
  if (lineup === undefined || squad.length < 11) return null

  try {
    const current = teamRating(startersOf(squad, lineup))
    const best = teamRating(startersOf(squad, bestXI(squad, lineup.formation)))
    const currentTotal = current.attack + current.defence
    const bestTotal = best.attack + best.defence

    return bestTotal > currentTotal ? { current: currentTotal, best: bestTotal } : null
  } catch {
    // An illegal stored XI is a different problem, and the reducer already
    // refuses to create one. Nothing useful to say here.
    return null
  }
}
