import { generateFixtures } from './fixtures.ts'
import { bestXI } from './lineup.ts'
import { ageOn, contractMonthsLeft, type Player } from './player.ts'
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

/** Contracts run to 30 June, as they do in reality. */
export function contractExpiry(year: number): DayNumber {
  return fromCivil(year, 6, 30)
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

export interface RolloverOptions {
  /** Name pool for the youngsters who replace retirees. */
  readonly names: readonly string[]
}

export function rolloverSeason(state: GameState, rng: Rng, options: RolloverOptions): GameState {
  const nextYear = state.season.startYear + 1
  const start = defaultSeasonStart(nextYear)

  const squads: Record<string, readonly Player[]> = {}
  const lineups = { ...state.lineups }

  for (const club of state.clubs) {
    const retained: Player[] = []
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

      // Expiring deals are renewed rather than released. A free-agent market is
      // M4b's problem, and without renewals a club that lost four contracts in one
      // summer would field ten players.
      retained.push(
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
    }

    const squad = [...retained, ...promoted]
    squads[club.id] = squad
    if (squad.length >= 11) {
      lineups[club.id] = bestXI(squad, state.lineups[club.id]?.formation ?? '4-4-2')
    }
  }

  return {
    ...state,
    squads,
    lineups,
    season: {
      startYear: nextYear,
      currentDate: start,
      fixtures: generateFixtures(state.competition.clubIds, start),
    },
  }
}
