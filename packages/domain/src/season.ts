import type { Club } from './entities.ts'
import { credit, EMPTY_LEDGER, positionsFrom, prizeMoney } from './finance.ts'
import { seasonSchedule } from './fixtures.ts'
import { bestXI, DEEPEST_BANK, fieldableFormation, keepsLineup } from './lineup.ts'
import { COUNTRIES, type Country, refreshForeignLeague } from './foreign.ts'
import { COVER_AT_POSITION, needFor } from './market.ts'
import {
  ageOn,
  contractMonthsLeft,
  overall,
  type Player,
  type Position,
  POSITIONS,
} from './player.ts'
import { generateYouthPlayer } from './squad.ts'
import type { Rng } from './rng.ts'
import type { GameState } from './state.ts'
import { type DayNumber, fromCivil, toCivil } from './time.ts'
import { renewedContract } from './valuation.ts'

/**
 * Rolling one season into the next — what makes a career rather than a sequence
 * of unrelated leagues.
 *
 * Until M4 there was no rollover at all: `simulateSeasons` called `newSeason` per
 * year, regenerating every player from scratch, so a squad could not drift and
 * M4's exit criterion ("sim ten seasons, squads should still look reasonable")
 * was literally unmeasurable.
 *
 * **Ageing is free.** `ageOn` derives from `birthDate` against the current date,
 * so advancing the clock ages the whole league without touching a player.
 *
 * This module owns `defaultSeasonStart` rather than `simulate.ts`, which would
 * otherwise import from here and be imported back.
 */

/** Mid-August, the traditional opening weekend. */
export function defaultSeasonStart(startYear: number): DayNumber {
  return fromCivil(startYear, 8, 15)
}

/**
 * Chance of hanging up the boots this summer. Nothing before 33, near-certain by
 * 39 — the shape of a real career's tail.
 *
 * Retirement is not decoration. A league that carries squads forward with no
 * outflow simply ages: ten seasons in, the average squad was 34 and every club
 * was a retirement home. The harness caught it, which is what the harness is for.
 */
function retirementChance(age: number): number {
  if (age < 33) return 0
  if (age < 35) return 0.15
  if (age < 37) return 0.4
  if (age < 39) return 0.7
  return 1
}

/**
 * A player whose deal is up is kept only if he is still worth something to the
 * XI. Below this he walks — the same marginal-rating score the transfer market
 * runs on, asked in the other direction.
 *
 * Not zero: a player worth a rounding error is not worth a three-year deal, and
 * a threshold of exactly zero would retain every bench player forever and leave
 * the free-agent pool permanently empty.
 */
const RETAIN_THRESHOLD = 0.5

/**
 * The squad a club keeps: what it releases *down to*, and what it signs *back up
 * to*. Deliberately above `MIN_SQUAD`.
 *
 * `MIN_SQUAD` is a hard floor ("a club will not sell below this"), and using it
 * here let every club drain to exactly 18. That looks harmless and quietly kills
 * the market: `surplus` returns nothing at 18, so nobody lists anybody, there is
 * nothing to buy, and the manager cannot sell either. Measured over ten seasons
 * the whole league sat at a mean of 18.4.
 *
 * **One number for both directions, because it is one intent.** It was only the
 * release floor until the league was measured over twenty seasons and found to be
 * *leaking players*: 460 at the start, 380 by season twenty and still falling. See
 * `topUp` for where they went.
 */
const TARGET_SQUAD = 21

/**
 * The size below which a club signs youth, and **deliberately lower than
 * `TARGET_SQUAD`.**
 *
 * Refilling all the way back to the release target every summer plugs the leak and
 * costs something real: it forces all twenty squads to the same size, which throws
 * away the lumpiness ADR 0010 went to some trouble to import, and it pours a great
 * deal of new talent into the league each year — measured, mean overall rose from
 * 71.7 to 73.9 over twenty seasons and mean age fell to 24.5.
 *
 * This is the leak-plugging figure instead: a club that has sold its way down near
 * the hard floor signs somebody, and one that is merely a little light does not.
 * Clubs that start large stay large — only the ones that have sold down are
 * refilled — so the shipped 19-to-29 spread survives a career.
 *
 * Measured over twenty seasons at 19, 20 and 21. All three hold the population
 * steady; the differences are in the market they leave behind. At 20 the league
 * settles at **413 players**, with **131–163 available to buy** and the best of them
 * **75–84** — against 98–142 and 72–81 at nineteen, and against a flattened league
 * where every squad sits on exactly 21 at the release target.
 */
const TOPUP_FLOOR = 20

/**
 * Summers a released player waits in the pool before he drops out of the game.
 *
 * **The pool had no exit but retirement, and retirement is zero below 33.** A
 * 25-year-old released because nobody needed him — which is exactly why he was
 * released — stayed for the rest of the career. There was a band on the pool being
 * too *small* and none on it being too large, which is why it shipped.
 *
 * It only became a permanent problem once `topUp` closed the population leak:
 * before that the pool drained because the whole league was shrinking, so the two
 * defects were masking each other. Measured with `topUp` and no patience rule, the
 * pool went 50, 57, 76, 97 and was still climbing at season twenty.
 *
 * **This is not the deletion that failed before.** Clearing every unsigned agent
 * each summer put inflow and outflow in the same step and drained the pool to
 * nothing by season six. A grace period holds several whole cohorts at once, and
 * `topUp` now guarantees the inflow it needs to stay non-empty.
 *
 * Derived from `contract.until`, which is already in the past and recedes a year
 * every summer — so no new state, and no schema change.
 */
const FREE_AGENT_PATIENCE_YEARS = 2

/** True when the squad still covers every formation after losing this player. */
function canRelease(remaining: readonly Player[], position: Position): boolean {
  return remaining.filter((p) => p.position === position).length >= DEEPEST_BANK[position]
}

export interface RolloverOptions {
  /** Name pool for the youngsters who replace retirees. */
  readonly names: readonly string[]
  /**
   * Name pools per country, for the youngsters who replace departures abroad.
   *
   * Optional because every harness in this package runs with no foreign clubs at
   * all, so there is nobody to name. When it is absent and clubs *do* exist, the
   * domestic pool stands in for every country — a visible degradation rather than
   * a crash, and one no shipping path takes.
   */
  readonly foreignNames?: Readonly<Record<Country, readonly string[]>>
  /**
   * What each foreign club is seeded to hold, so its balance goes back there each
   * summer rather than compounding. Supplied by the caller for the same reason
   * `foreignNames` is: the figures live in `@fm/data`.
   */
  readonly foreignBudgets?: Readonly<Record<string, number>>
}

/**
 * Close the books: prize money by final position, then a clean ledger.
 *
 * Lives here rather than in `startNewSeason` because `simulateCareer` calls
 * `rolloverSeason` directly — putting the settlement in the command handler would
 * have given the harness a different economy from the one the game plays, which
 * is exactly the kind of gap a regression net is supposed to close.
 *
 * A season with nothing played awards nothing. That is not a guard against a bug
 * so much as the honest answer for a career resumed mid-summer.
 */
function settleSeason(state: GameState, nextYear: number): readonly Club[] {
  const positions = positionsFrom(state.competition.clubIds, state.season.fixtures)
  const clubCount = state.competition.clubIds.length

  return state.clubs.map((club) => {
    const position = positions?.get(club.id)
    const prize = position === undefined ? 0 : prizeMoney(position, clubCount)
    const closed = credit(club.ledger, 'prize', prize)
    // Seats commissioned last season open now. The money left when the work was
    // ordered, so this moves capacity and nothing else.
    const opening = club.expansion !== null && club.expansion.readyYear <= nextYear
    return {
      ...club,
      capacity: opening ? club.capacity + (club.expansion?.seats ?? 0) : club.capacity,
      expansion: opening ? null : club.expansion,
      // The balance moves by what the whole season's ledger nets, and the ledger
      // then starts again from nothing. Computing the delta any other way is how
      // the identity in ADR 0009 drifts.
      budget: club.budget + prize,
      ledger: EMPTY_LEDGER,
      lastLedger: closed,
    }
  })
}

/**
 * Youngsters signed to bring a thin squad back up to `TARGET_SQUAD`.
 *
 * **This exists because the league was leaking players and nothing said so.**
 * Measured over twenty seasons before it was written: the population fell from
 * **460 to 380 and was still falling**, squads settled at **18.9** against a
 * release floor of 21, the number of players available to buy anywhere in the
 * league fell from **234 to 60**, and the best of them from **80 to 68**. That is
 * the real reason a manager sees the same faces every window — there are fewer
 * players every year, and the good ones are gone.
 *
 * The leak had one source and it is not obvious from any single function.
 * Retirement is replaced one-for-one at the same club, and a transfer is neutral
 * across the league — but a **release is not**. A player let go joins the pool,
 * and if nobody signs him he ages there until he retires **out of the game**,
 * with nothing generated to replace him. Clubs also sell down to `MIN_SQUAD` in
 * the window and could only buy back one free agent a summer, so once the pool
 * thinned there was no route back up at all.
 *
 * Topping up at the rollover closes it exactly where it opens, and it is also the
 * answer to the complaint: **every summer brings faces nobody has seen**, drawn
 * from `PLAYER_NAMES` rather than from the shipped rosters, which is the drift
 * ADR 0010 says a long career is supposed to have.
 *
 * At the **thinnest position**, so a club that sold two centre-backs signs two
 * defenders rather than whatever the loop reached first — the same reasoning as
 * replacing a retiree at his own position.
 */
function topUp(
  squad: readonly Player[],
  club: Club,
  rng: Rng,
  options: { names: readonly string[]; seasonStart: DayNumber; year: number; from: number },
): Player[] {
  const working = [...squad]
  let serial = options.from

  while (working.length < TOPUP_FLOOR) {
    // Thinnest relative to what a 4-4-2 asks for, so a squad short of one keeper
    // is filled before one short of a fourth midfielder.
    const position = POSITIONS.reduce((thinnest, candidate) => {
      // Short relative to the cover the market rule demands, not to what a
      // formation asks for on the day: `DEEPEST_BANK` is 1 at goalkeeper, so a
      // squad down to its last keeper would read as fully stocked.
      const need = (p: Position) =>
        working.filter((x) => x.position === p).length - COVER_AT_POSITION[p]
      return need(candidate) < need(thinnest) ? candidate : thinnest
    })

    working.push(
      generateYouthPlayer(club, position, rng, {
        names: options.names,
        seasonStart: options.seasonStart,
        serial: `${options.year}-${serial++}`,
      }),
    )
  }

  return working
}

/** Every country pointed at one pool — see `RolloverOptions.foreignNames`. */
function fallbackPools(names: readonly string[]): Readonly<Record<Country, readonly string[]>> {
  return Object.fromEntries(COUNTRIES.map((country) => [country, names])) as Record<
    Country,
    readonly string[]
  >
}

export function rolloverSeason(state: GameState, rng: Rng, options: RolloverOptions): GameState {
  const nextYear = state.season.startYear + 1
  const start = defaultSeasonStart(nextYear)

  const squads: Record<string, readonly Player[]> = {}
  const lineups = { ...state.lineups }

  // Free agents stay free agents until somebody signs them or they retire.
  //
  // Deleting the unsigned each summer looked tidier and was wrong: releases
  // outnumber signings, so every club ground down to the squad floor, at which
  // point nothing more could be released and the pool measured 45, 37, 15, 3, 0
  // and stayed empty from season six — closing the only route into the market a
  // club with no money has. Left alone, the pool balances itself: clubs sign from
  // it for nothing, which lifts squads back above the floor, which frees more
  // players next summer. Age is what removes them, as it removes everyone.
  //
  // **The two filters are in this order deliberately.** The retirement roll draws
  // one `rng.next()` per pooled player, so filtering first would change how many
  // draws *this* rollover makes and shift the stream for a reason unrelated to the
  // feature. Filtering after leaves this rollover's draw count exactly as it was;
  // later seasons see fewer draws only because the pool is smaller, which is the
  // point of the change.
  const freeAgents: Player[] = state.freeAgents
    .filter((player) => rng.next() >= retirementChance(ageOn(player, start)))
    .filter(
      (player) => toCivil(start).y - toCivil(player.contract.until).y <= FREE_AGENT_PATIENCE_YEARS,
    )

  for (const club of state.clubs) {
    const survivors: Player[] = []
    const promoted: Player[] = []
    let serial = 0

    for (const player of state.squads[club.id] ?? []) {
      if (rng.next() < retirementChance(ageOn(player, start))) {
        // One in, one out, at the same position — squad shape survives a decade
        // without any explicit rule about squad size.
        promoted.push(
          generateYouthPlayer(club, player.position, rng, {
            names: options.names,
            seasonStart: start,
            serial: `${nextYear}-${serial++}`,
          }),
        )
        continue
      }
      survivors.push(player)
    }

    // Who to let go. Weakest first, so a club releasing two players sheds the two
    // it wants least rather than whichever the squad order happened to reach.
    const working = [...survivors, ...promoted]
    const expiring = working
      .filter((player) => contractMonthsLeft(player, start) <= 0)
      .sort((a, b) => overall(a) - overall(b))

    for (const player of expiring) {
      if (working.length <= TARGET_SQUAD) break

      const without = working.filter((p) => p.id !== player.id)
      if (!canRelease(without, player.position)) continue
      // Still improves the XI, so the club renews rather than letting a rival
      // have him for nothing.
      if (needFor(without, player) > RETAIN_THRESHOLD) continue

      working.splice(
        working.findIndex((p) => p.id === player.id),
        1,
      )
      freeAgents.push(player)
    }

    // Everyone left whose deal was up gets a new one.
    const squad = working.map((player) =>
      contractMonthsLeft(player, start) > 0
        ? player
        : { ...player, contract: renewedContract(player, start, rng) },
    )

    // **After the releases, not instead of them.** A club sheds who it does not
    // want and then signs youth to fill the hole, which is what a real one does;
    // running it the other way round would have it release the boy it just took.
    squads[club.id] = topUp(squad, club, rng, {
      names: options.names,
      seasonStart: start,
      year: nextYear,
      from: serial,
    })
    // AI clubs always revert to their strongest XI — that is the only place they
    // ever pick a team, so skipping it would leave them fielding last year's.
    // The manager's own selection is left alone while it is still legal: a
    // retirement elsewhere in the squad is no reason to undo his team sheet.
    const finished = squads[club.id] ?? squad
    const protectSelection =
      club.id === state.managedClubId && keepsLineup(finished, state.lineups[club.id])

    if (finished.length >= 11 && !protectSelection) {
      // Retirements and releases can take a squad below the bank its shape needs,
      // the same way a sale can in `applyTransfers`. Fall back rather than throw.
      const formation = fieldableFormation(finished, state.lineups[club.id]?.formation ?? '4-4-2')
      lineups[club.id] = bestXI(finished, formation)
    }
  }

  // Anyone who retired or was released comes off the transfer list with them.
  const own = new Set((squads[state.managedClubId] ?? []).map((player) => player.id))

  return {
    ...state,
    clubs: settleSeason(state, nextYear),
    // The season being closed, kept before its fixtures are replaced — this is the
    // only instant at which they still exist. A season with nothing played is not
    // archived, mirroring `settleSeason` awarding it no prize money: naming a
    // champion of nothing would be a lie the palmarés then repeats forever.
    //
    // This retains the array rather than copying it, and draws no randomness, so
    // it is inert for everything already calibrated.
    history: state.season.fixtures.some((fixture) => fixture.result !== null)
      ? [
          ...state.history,
          {
            startYear: state.season.startYear,
            clubIds: state.competition.clubIds,
            fixtures: state.season.fixtures,
            managedClubId: state.managedClubId,
          },
        ]
      : state.history,
    squads,
    lineups,
    freeAgents,
    // Abroad ages the same way and on its own derived stream, so this draws
    // nothing from `rng` and cannot move a calibrated band. Players who leave a
    // foreign club leave the game rather than joining `freeAgents` — see
    // `refreshForeignLeague` for why that matters.
    foreign: refreshForeignLeague(
      state.foreign,
      nextYear,
      { names: options.foreignNames ?? fallbackPools(options.names), seasonStart: start },
      options.foreignBudgets,
    ),
    transferList: state.transferList.filter((id) => own.has(id)),
    season: {
      startYear: nextYear,
      currentDate: start,
      fixtures: seasonSchedule(state.competition.clubIds, nextYear, start),
    },
  }
}
