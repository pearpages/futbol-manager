import { generateFixtures } from './fixtures.ts'
import { bestXI, FORMATIONS, keepsLineup } from './lineup.ts'
import { MIN_SQUAD, needFor } from './market.ts'
import {
  ageOn,
  contractExpiry,
  contractMonthsLeft,
  overall,
  type Player,
  type Position,
  POSITIONS,
} from './player.ts'
import { generateYouthPlayer } from './squad.ts'
import type { Rng } from './rng.ts'
import type { GameState } from './state.ts'
import { type DayNumber, fromCivil } from './time.ts'
import { expectedWage } from './valuation.ts'

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
 * How long a renewal runs, by age. Clubs commit long to players entering their
 * peak and short to those leaving it, which is what stops a league silently
 * filling with thirty-somethings on five-year deals.
 */
function renewalYears(age: number, rng: Rng): number {
  if (age <= 23) return 3 + Math.floor(rng.next() * 2)
  if (age <= 29) return 2 + Math.floor(rng.next() * 3)
  if (age <= 32) return 1 + Math.floor(rng.next() * 2)
  return 1
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
const RETAIN_THRESHOLD = 0.25

/**
 * The deepest requirement at each position across every formation — 5 defenders
 * for a 5-3-2, 5 midfielders for a 3-5-2, 3 forwards for a 4-3-3.
 *
 * Releasing down to 4-4-2's shape would leave a squad unable to field the other
 * three formations, which the career harness asserts against directly. Derived
 * rather than written out, so adding a formation cannot silently invalidate it.
 */
const DEEPEST: Readonly<Record<Position, number>> = Object.freeze(
  Object.fromEntries(
    POSITIONS.map((position) => [
      position,
      Math.max(...Object.values(FORMATIONS).map((shape) => shape[position])),
    ]),
  ) as Record<Position, number>,
)

/** True when the squad still covers every formation after losing this player. */
function canRelease(remaining: readonly Player[], position: Position): boolean {
  return remaining.filter((p) => p.position === position).length >= DEEPEST[position]
}

export interface RolloverOptions {
  /** Name pool for the youngsters who replace retirees. */
  readonly names: readonly string[]
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
  const freeAgents: Player[] = state.freeAgents.filter(
    (player) => rng.next() >= retirementChance(ageOn(player, start)),
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
      if (working.length <= MIN_SQUAD) break

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
        : {
            ...player,
            contract: {
              until: contractExpiry(nextYear + renewalYears(ageOn(player, start), rng)),
              wage: expectedWage(player, start),
            },
          },
    )

    squads[club.id] = squad
    // AI clubs always revert to their strongest XI — that is the only place they
    // ever pick a team, so skipping it would leave them fielding last year's.
    // The manager's own selection is left alone while it is still legal: a
    // retirement elsewhere in the squad is no reason to undo his team sheet.
    const protectSelection =
      club.id === state.managedClubId && keepsLineup(squad, state.lineups[club.id])

    if (squad.length >= 11 && !protectSelection) {
      lineups[club.id] = bestXI(squad, state.lineups[club.id]?.formation ?? '4-4-2')
    }
  }

  return {
    ...state,
    squads,
    lineups,
    freeAgents,
    season: {
      startYear: nextYear,
      currentDate: start,
      fixtures: generateFixtures(state.competition.clubIds, start),
    },
  }
}
