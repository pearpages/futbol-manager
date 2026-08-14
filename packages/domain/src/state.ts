import type { Bid } from './bids.ts'
import type { Board } from './board.ts'
import type { Club, ClubId, Competition, Fixture, Season } from './entities.ts'
import type { Lineup, Tactics } from './lineup.ts'
import type { Player, PlayerId } from './player.ts'
import type { DayNumber } from './time.ts'

/**
 * The complete game state. Everything the simulation needs to resume identically
 * lives here — this is what `persistence` wraps in a versioned envelope alongside
 * the PRNG state.
 */
export interface GameState {
  readonly clubs: readonly Club[]
  readonly competition: Competition
  readonly season: Season
  /** Squad per club. Added at M3; the v1→v2 migration generates them for older saves. */
  readonly squads: Readonly<Record<string, readonly Player[]>>
  /** Selected XI and tactics per club. AI clubs are re-picked from `bestXI` each matchday. */
  readonly lineups: Readonly<Record<string, Lineup>>
  readonly tactics: Readonly<Record<string, Tactics>>
  /**
   * The club the human manages. Everything else in the league is played by the AI.
   * Added at M3b — a save from before then is migrated by adopting the first club.
   */
  readonly managedClubId: ClubId
  /**
   * Out of contract and unattached. Added at M4b.
   *
   * Until now every expiring deal was renewed, because a club that let four
   * contracts lapse in one summer would field ten players. Renewals now depend on
   * whether the club still needs the player, and the ones nobody wants land here.
   * This is the route a poor club has into a market where nothing good is ever
   * listed for sale: a free agent costs no fee, only wages.
   */
  readonly freeAgents: readonly Player[]
  /**
   * Live and settled bids, both directions. Yours are `from === managedClubId`;
   * offers for your players are `to === managedClubId`.
   *
   * State rather than a transient, because an answer takes days to arrive and has
   * to survive a save — which is what made this a schema bump.
   */
  readonly bids: readonly Bid[]
  /** Players you are watching. Persisted, so it survives closing the tab. */
  readonly shortlist: readonly PlayerId[]
  /**
   * Your players you have put up for sale. Added at M4c.
   *
   * Your club is otherwise invisible to the AI market — `runTransferWindow`
   * excludes it so nobody trades your squad behind your back. Listing a player is
   * how you opt him, and only him, back into the pool AI clubs shop from. **The
   * listing is the consent**, so a listed player who attracts a buyer is sold
   * without a further prompt; the bid inbox is for unsolicited offers.
   */
  readonly transferList: readonly PlayerId[]
  /**
   * The board's target and its patience, added at M5b.
   *
   * About the managed club only — the AI answers to nobody, which is why this is
   * one object rather than a per-club record. A headless career carries one too
   * and simply never reads it, so the harness measures the same football.
   */
  readonly board: Board
}

export function clubIds(state: GameState): readonly ClubId[] {
  return state.competition.clubIds
}

export function fixtures(state: GameState): readonly Fixture[] {
  return state.season.fixtures
}

export function currentDate(state: GameState): DayNumber {
  return state.season.currentDate
}

export function squadOf(state: GameState, clubId: ClubId): readonly Player[] {
  return state.squads[clubId] ?? []
}

/** True once every fixture in the season has a result. */
export function isSeasonComplete(state: GameState): boolean {
  return state.season.fixtures.every((f) => f.result !== null)
}
