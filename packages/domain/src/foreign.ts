import type { Club, ClubId, Ledger } from './entities.ts'
import { EMPTY_LEDGER } from './finance.ts'
import { COVER_AT_POSITION } from './market.ts'
import { ageOn, contractMonthsLeft, type Player, type Position, POSITIONS } from './player.ts'
import { createRng, hashSeed } from './rng.ts'
import { generateSquad, referenceValues, type RosterEntry } from './squad.ts'
import type { DayNumber } from './time.ts'
import { renewedContract } from './valuation.ts'

/**
 * Clubs abroad — a **source of players and nothing else**.
 *
 * They have squads, budgets and a place in the market in both directions. They do
 * not have fixtures, a table, a lineup, gate receipts, a ledger or a screen. A
 * manager sees a foreign club's name and badge on a listing and can bid for its
 * players; that is the whole of it. The second competition ground rule 5 is
 * waiting for is M7's business, and this is deliberately not it.
 *
 * ## Why this is not in `state.clubs`
 *
 * Four loops, each of which would need a special case, and one of them throws:
 *
 * - `advanceDay` builds a `TeamRating` for **every** entry in `state.clubs` and
 *   throws `No lineup selected` if one has none. There is no `ErrorBoundary`
 *   anywhere in the app, so that is a blank screen.
 * - `settleFinances` pays TV money and sponsorship to every club, so a club that
 *   plays no fixtures would collect both, and its wage bill would enter the
 *   economy the league-total band measures.
 * - `settleSeason` awards prize money keyed on a position in the competition.
 * - `newSeason` derives `competition.clubIds` — and therefore the fixture list —
 *   from the array it is handed.
 *
 * A separate sub-state means **none of those four changes at all**, and an empty
 * league is exactly the behaviour that shipped before it existed. That is what
 * makes the migration one line and what lets every calibrated band go on
 * measuring the division it has always measured: `TEST_CLUBS` ships no foreign
 * clubs, so every harness runs with this empty.
 *
 * ## Why nothing here takes an `Rng`
 *
 * Every squad is generated from `createRng(hashSeed(club.id, year))` — a derived
 * generator seeded from state that already exists. Building seven hundred players
 * therefore draws **nothing** from the main stream, `pnpm season` stays
 * byte-identical, and no distribution band moves. This is the single most
 * important property of the module and the reason it has no `rng` parameter to
 * pass by mistake.
 */

/** Where a foreign club plays. Used for grouping and filtering, never for a table. */
export type Country = 'EN' | 'DE' | 'FR' | 'IT' | 'PT' | 'NL' | 'BE' | 'TR'

export const COUNTRIES: readonly Country[] = ['EN', 'DE', 'FR', 'IT', 'PT', 'NL', 'BE', 'TR']

/**
 * A club abroad.
 *
 * **One rating, not an attack/defence split**, because nothing resolves a match
 * for it and the split exists solely to feed `expectedGoals`. No capacity, ticket
 * price or expansion — there is no gate. No ledger: it sits outside ADR 0009's
 * identity, which is per domestic club, and a foreign counterparty is
 * indistinguishable from any other from the domestic side of a deal.
 */
export interface ForeignClub {
  /**
   * Country-prefixed, so a collision with a domestic id is impossible by
   * construction rather than by care — and so a log line says where it is.
   */
  readonly id: ClubId
  readonly name: string
  readonly shortName: string
  readonly country: Country
  /** Same 60–94 scale the domestic clubs use. */
  readonly rating: number
  /** Thousands. Reset each rollover — see `refreshForeignLeague`. */
  readonly budget: number
}

export interface ForeignLeague {
  readonly clubs: readonly ForeignClub[]
  readonly squads: Readonly<Record<string, readonly Player[]>>
}

/**
 * No clubs abroad — what every harness runs with, and what a save from before this
 * existed is migrated to.
 *
 * A legal, playable state: every path that touches the foreign layer iterates
 * `clubs` and does nothing for an empty array, which is what keeps this feature
 * free of conditionals elsewhere.
 */
export const NO_FOREIGN: ForeignLeague = { clubs: [], squads: {} }

/**
 * The `Club` shape `generateSquad` and `generateYouthPlayer` expect.
 *
 * Private, and it never escapes this module. The finance fields are zeroed rather
 * than plausible: nothing reads them, and a plausible figure would invite
 * something to start.
 */
function asClub(club: ForeignClub): Club {
  const ledger: Ledger = EMPTY_LEDGER
  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    attack: club.rating,
    defence: club.rating,
    budget: club.budget,
    capacity: 0,
    ticketPrice: 0,
    expansion: null,
    ledger,
    lastLedger: ledger,
  }
}

export interface ForeignOptions {
  /**
   * Name pools **per country**, so a club in Dortmund does not field a squad of
   * Spanish names. `@fm/data` supplies `INTL_NAMES`; a country with no pool falls
   * back to the first one there is, which is a degradation rather than a crash.
   *
   * **These no longer name the opening squads** — `rosters` does — but they still
   * name everyone who arrives afterwards, which is what makes a career drift off
   * the shipped squads on its own. Same arrangement `PLAYER_NAMES` has at home.
   */
  readonly names: Readonly<Record<Country, readonly string[]>>
  readonly seasonStart: DayNumber
  /**
   * Real squad shapes, keyed by club id — positions, ages, squad sizes and the
   * value ordering inside each squad. `@fm/data` supplies `FOREIGN_ROSTERS`;
   * a club without one is generated exactly as before, which is what lets this
   * arrive a country at a time.
   */
  readonly rosters?: Readonly<Record<string, readonly RosterEntry[]>>
  /**
   * The per-position value norm each squad's depth curve is measured against.
   *
   * **Supply the norm of the whole game — domestic rosters and these together —
   * not of these alone.** Computed over the foreign set by itself it is measuring
   * thirty-two of the richest clubs in Europe against each other, so every
   * position's spread comes out the same and a first-choice goalkeeper reads as
   * big a star as a €120M forward. Measured: the top-rated player was a keeper at
   * **22 of 32 clubs abroad against 4 of 20 at home**, purely because a league
   * with a real tail has much lower medians.
   *
   * Falls back to the foreign rosters alone, which is a degradation rather than a
   * crash and is what the harness runs on.
   */
  readonly reference?: Readonly<Partial<Record<Position, number>>>
}

/**
 * This club's slice of its country's pool.
 *
 * **Sliced, not shared.** `generateSquad` indexes from zero, so handing every club
 * the whole pool gives all six English clubs the same twenty-three names — which
 * is what happened, and what a market screen showing two Andreas Kerners caught.
 * `generateLeagueSquads` already slices for the same reason; this is that, per
 * country. `offset` is the club's place among its countrymen.
 *
 * Falls back to any pool at all rather than to nothing, which degrades to odd
 * names instead of to `Player 1`.
 */
function namesFor(options: ForeignOptions, country: Country, offset: number): readonly string[] {
  const pool = options.names[country] ?? Object.values(options.names)[0] ?? []
  const size = Math.max(1, Math.floor(pool.length / 8))
  const start = (offset * size) % Math.max(1, pool.length)
  return [...pool.slice(start), ...pool.slice(0, start)]
}

/** Where a club sits among the others from its country, for the name slice. */
function offsetsByCountry(clubs: readonly ForeignClub[]): Map<ClubId, number> {
  const seen = new Map<Country, number>()
  const offsets = new Map<ClubId, number>()
  for (const club of clubs) {
    const next = seen.get(club.country) ?? 0
    offsets.set(club.id, next)
    seen.set(club.country, next + 1)
  }
  return offsets
}

/** Every foreign squad, generated from a derived stream. */
export function generateForeignLeague(
  clubs: readonly ForeignClub[],
  startYear: number,
  options: ForeignOptions,
): ForeignLeague {
  const squads: Record<string, readonly Player[]> = {}
  const offsets = offsetsByCountry(clubs)
  const rosters = options.rosters ?? {}

  // **The norm is pooled across the whole game, and it is supplied rather than
  // computed here.** The two leagues trade in the same currency, so a €120M
  // forward should read as a superstar against the world rather than against the
  // thirty-two clubs that can afford one. It is one-sided on purpose:
  // `generateLeagueSquads` still computes its own from the domestic rosters, so
  // the twenty Spanish squads are **byte-identical** and no calibrated band moves.
  const reference = options.reference ?? referenceValues(Object.values(rosters))

  for (const club of clubs) {
    const roster = rosters[club.id]
    squads[club.id] = generateSquad(asClub(club), createRng(hashSeed(club.id, startYear)), {
      names: namesFor(options, club.country, offsets.get(club.id) ?? 0),
      seasonStart: options.seasonStart,
      ...(roster === undefined ? {} : { roster, reference }),
    })
  }

  return { clubs, squads }
}

/**
 * Chance a foreign player leaves at the end of a season.
 *
 * **This is the churn that answers "there are always the same players" from
 * abroad**, and it is deliberately blunter than the domestic model: a foreign
 * squad has no contracts anybody negotiates and no board watching it, so who goes
 * is not a decision the game needs to make well. A sixth of each squad turns over
 * a year, which is roughly a real one.
 */
const CHURN_RATE = 1 / 6

/**
 * The size a foreign club restocks to.
 *
 * Without a floor a club that had been sold from would refill only to whatever it
 * had left, so the whole layer would ratchet down as the domestic league bought
 * from it — measured at 736 players falling to 690 over twelve seasons and still
 * going. It is the same leak `topUp` closes at home, arriving by a different route.
 */
const MIN_FOREIGN_SQUAD = 22

/**
 * Age a foreign league into the next season: some leave, youth replace them.
 *
 * **Players who leave a foreign club leave the game.** They do not join
 * `state.freeAgents` — that would reopen the saturation the domestic patience rule
 * exists to prevent, and it would let a manager hoover up the world for nothing.
 *
 * **Budgets reset rather than accumulate**, which is what stops the foreign layer
 * ratcheting into a bank that can buy the division out. It is a source and a sink,
 * not a participant in the economy.
 *
 * Derived stream again, keyed on the year, so a career is reproducible and the
 * main generator is untouched.
 */
export function refreshForeignLeague(
  league: ForeignLeague,
  startYear: number,
  options: ForeignOptions,
  seeded?: Readonly<Record<string, number>>,
): ForeignLeague {
  const squads: Record<string, readonly Player[]> = {}
  const offsets = offsetsByCountry(league.clubs)

  for (const club of league.clubs) {
    const rng = createRng(hashSeed(club.id, 'refresh', startYear))
    const squad = league.squads[club.id] ?? []

    // Oldest first, so the ones who go are the ones a real club would let go.
    //
    // **A `DayNumber` counts up, so the oldest player has the _smallest_
    // `birthDate`** and this sort is ascending. Written the other way round it
    // released the youngest instead: the foreign league aged from 26.6 to 35.0 over
    // twelve seasons while the same veterans sat there, and 71% of the opening
    // squads were still in place. Caught by the harness's ageing band.
    const leaving = new Set(
      [...squad]
        .sort((a, b) => a.birthDate - b.birthDate)
        .slice(0, Math.round(squad.length * CHURN_RATE))
        .map((player) => player.id),
    )
    // **Everyone kept whose deal has run out is given a new one**, the way the
    // rollover renews at home. Without it nobody abroad was ever renewed: a lapsed
    // contract prices a player at 0, so by 2029 388 of 758 foreign players could
    // be signed for a fee of 1, an overall-92 among them, and the AI imported most
    // of its signings for nothing.
    //
    // Its own derived stream, not `rng` above: drawing renewal lengths from that
    // one would shift every recruit generated below, and not the main stream
    // either, which would move every calibrated band at home.
    const renewals = createRng(hashSeed(club.id, 'renew', startYear))
    const kept = squad
      .filter((player) => !leaving.has(player.id))
      .map((player) =>
        contractMonthsLeft(player, options.seasonStart) > 0
          ? player
          : { ...player, contract: renewedContract(player, options.seasonStart, renewals) },
      )

    // **Replacements arrive at the club's own standard, not out of its academy**,
    // and that is the difference between a source that lasts and one that wears
    // out. A foreign club recruits from the rest of the world, which this game does
    // not model; filling its holes with teenagers instead made abroad pay for every
    // player the domestic league bought from it — mean age fell from 26.6 to 20.5
    // over twelve seasons and kept going, at every churn rate tried, because Spain
    // took the established players and left the kids.
    //
    // Generating a squad and drawing from it reuses the calibrated generator —
    // right ages, right depth curve, right contracts — rather than inventing a
    // second one. The ids carry the year, so a recruit can never collide with the
    // man he replaced.
    //
    // **Deliberately from the name pools and never from the roster.** Handed the
    // roster this would re-issue names already on that club's books, and the
    // duplicate-name guard only inspects the roster files, so it would go
    // unnoticed. It is also the right behaviour: `PLAYER_NAMES` still names youth
    // intake at home for the same reason, so a career drifts off the shipped
    // squads on its own — at home and now abroad.
    // **Names already at the club are taken out of the pool first**, and this is
    // not belt-and-braces: `generateSquad` indexes from the start of whatever it
    // is handed, so handing it the club's own slice year after year re-issues the
    // names of men who never left. A club ended up with two players of the same
    // name, which is invisible until both are on one screen — exactly how the
    // shipped domestic rosters' own collision went unnoticed.
    const onTheBooks = new Set(kept.map((player) => player.name))
    const recruits = generateSquad(asClub(club), rng, {
      names: namesFor(options, club.country, offsets.get(club.id) ?? 0).filter(
        (name) => !onTheBooks.has(name),
      ),
      seasonStart: options.seasonStart,
    }).map((player, index) => ({
      ...player,
      id: `${club.id}-r${String(startYear)}-${String(index)}` as Player['id'],
    }))

    const target = Math.max(squad.length, MIN_FOREIGN_SQUAD)
    const working = [...kept]
    const taken = new Set<string>()
    while (working.length < target) {
      const position = thinnest(working)
      const recruit = recruits.find((p) => p.position === position && !taken.has(p.id))
      /* c8 ignore next */
      if (recruit === undefined) break
      taken.add(recruit.id)
      working.push(recruit)
    }

    squads[club.id] = working
  }

  // **Budgets go back to what the club was seeded with**, which is what the
  // comment above promised and what stops the layer ratcheting into a bank. A
  // foreign club that sold three players last summer does not start the next one
  // three fees richer than the game intended it to be; a foreign club is a source
  // and a sink, not a participant in the economy.
  //
  // The seeded figures come from the caller because they live in `@fm/data`,
  // which this package may not import. Absent, the current balances stand — the
  // degradation is that a career drifts, not that it breaks.
  const clubs =
    seeded === undefined
      ? league.clubs
      : league.clubs.map((club) => ({ ...club, budget: seeded[club.id] ?? club.budget }))

  return { clubs, squads }
}

/**
 * The position a squad is shortest of, **measured against the cover every
 * formation needs** rather than against the other positions.
 *
 * A raw count is the wrong comparison and it shipped once already, in the
 * rollover's `topUp`: a squad wants five midfielders and two keepers, so "fewest
 * players" always points at goalkeeper and never at the bank that is actually
 * short. Here it produced foreign squads that could not field 3-5-2, which the
 * harness caught.
 */
function thinnest(squad: readonly Player[]): Position {
  const short = (position: Position) =>
    squad.filter((p) => p.position === position).length - COVER_AT_POSITION[position]

  // **The tiebreak is not a detail.** Cover is 2 at goalkeeper and 5 in each
  // outfield bank, so a squad one over everywhere ties at every position — and
  // `POSITIONS` lists goalkeeper first, so a plain `<` hands every one of those
  // ties to a third keeper. Measured over twelve refreshes it drifted every club
  // to **four goalkeepers**. On a tie the bank that needs more players wins, which
  // keeps a squad the shape a squad is.
  return POSITIONS.reduce((worst, candidate) => {
    if (short(candidate) !== short(worst))
      return short(candidate) < short(worst) ? candidate : worst
    return COVER_AT_POSITION[candidate] > COVER_AT_POSITION[worst] ? candidate : worst
  })
}

/** Everyone abroad, for a lookup that has to find a player wherever he is. */
export function foreignPlayers(league: ForeignLeague): readonly Player[] {
  return league.clubs.flatMap((club) => league.squads[club.id] ?? [])
}

/** Which foreign club holds this player, or `null`. */
export function foreignHolderOf(league: ForeignLeague, playerId: string): ForeignClub | null {
  return (
    league.clubs.find((club) =>
      (league.squads[club.id] ?? []).some((player) => player.id === playerId),
    ) ?? null
  )
}

/** Mean age abroad, for the harness. */
export function foreignMeanAge(league: ForeignLeague, date: DayNumber): number {
  const players = foreignPlayers(league)
  if (players.length === 0) return 0
  return players.reduce((sum, p) => sum + ageOn(p, date), 0) / players.length
}
