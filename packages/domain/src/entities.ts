import type { DayNumber } from './time.ts'

/**
 * Core entities. Everything is `readonly` — ground rule 2 means state is replaced,
 * never mutated, and the type system should say so rather than rely on discipline.
 */

export type ClubId = string & { readonly __clubId: unique symbol }
export type FixtureId = string & { readonly __fixtureId: unique symbol }

/**
 * What the result resolver consumes, per side.
 *
 * This is the contract defined in docs/attribute-model.md. At M2 it came off the
 * club directly; from M3 it is computed from the starting XI. The resolver never
 * learns the difference — M3 replaced the supplier, not the signature.
 */
export interface TeamRating {
  /** 1–99. */
  readonly attack: number
  /** 1–99. */
  readonly defence: number
  /**
   * How open this side wants the game, −1 (low block) to +1 (all-out attack).
   *
   * Added at M3c. `attack` and `defence` describe how strength is *split*;
   * nothing described how many chances a game has, so a low block could not do
   * the one thing a low block is for. Lower tempo means fewer goals for both
   * sides, which means more draws — worth far more to the weaker team.
   *
   * Zero at balanced tactics, so the M2 calibration is untouched by default.
   */
  readonly tempo: number
}

export interface Club {
  readonly id: ClubId
  readonly name: string
  /** Short form for tables, where 20 rows of full names do not fit. */
  readonly shortName: string
  /**
   * **Provisional, M2 only.** Stands in for a squad until players exist. At M3
   * these stop being read: the rating is derived from the selected XI via the
   * position-weighted collapse in docs/attribute-model.md, and these fields become
   * a seed for squad generation rather than a live input to results.
   */
  readonly attack: number
  readonly defence: number
  /**
   * The club's money, in thousands. Added at M4 as a transfer kitty; at M5a it
   * became a running balance that revenue feeds and wages drain.
   *
   * Seeded from the club's rating, which is what keeps the table's shape stable
   * across a decade: if Almería could outspend Madrid the league would invert
   * within a few seasons. **M5a kept the seed as the opening position** and made
   * revenue the ongoing source — replacing both at once would have moved two
   * things and left nothing to measure against.
   *
   * **This may be negative.** A club can run into debt down to `debtLimit`; see
   * `finance.ts`.
   */
  readonly budget: number
  /**
   * Seats. The gate-receipts denominator, added at M5a.
   *
   * Seeded from rating on the same convex curve as the budget, for the same
   * reason: a big club's ground is not slightly larger than a small one's.
   */
  readonly capacity: number
  /**
   * What a seat costs, per home match. Added at M5b as the manager's lever.
   *
   * Seeded to `FINANCE.TICKET` — the league default — so an AI club simply keeps
   * it and nothing about M5a's calibration moves. Only the managed club ever
   * changes it.
   */
  readonly ticketPrice: number
  /**
   * Building work paid for and not yet delivered, or `null`.
   *
   * The seats arrive at the rollover rather than the moment you pay, which is
   * the only thing that makes expansion a decision: you commit the money a
   * season before you find out whether you needed it.
   */
  readonly expansion: Expansion | null
  /**
   * What the club has earned and spent **this season**. Reset at rollover, after
   * the season's prize money lands.
   *
   * Kept per club rather than as a league total because that is what makes the
   * balance invariant exact — see `LEDGER_KEYS` in `finance.ts`. The old
   * invariant caught "the league inflated"; this one says which club and which
   * line.
   */
  readonly ledger: Ledger
  /**
   * The season just finished, complete with its prize money.
   *
   * Not a convenience. Prize money lands *at* the rollover, in the same step
   * that clears `ledger`, so without this the one line that closes a season's
   * accounts would never be visible in any state — and the balance identity
   * would have a hole in it exactly where the money moves. It is also what a
   * finance screen means by "last season".
   */
  readonly lastLedger: Ledger
}

/**
 * One season's income and outgoings, in thousands, all stored positive.
 *
 * Sign is a property of the line rather than the number, which is what lets the
 * invariant be written once over `LEDGER_KEYS` instead of field by field.
 */
export interface Ledger {
  readonly gate: number
  readonly tv: number
  readonly sponsor: number
  readonly prize: number
  /** Net fees received minus fees paid. The one line that may be negative. */
  readonly transfers: number
  readonly wages: number
  /** Paid to the player on signing, so it leaves the league entirely. */
  readonly bonuses: number
  /** Charged only while the balance is negative. */
  readonly interest: number
  /** Building work. Leaves the league entirely, like a signing bonus. */
  readonly stadium: number
}

export function clubRating(club: Club): TeamRating {
  return { attack: club.attack, defence: club.defence, tempo: 0 }
}

/** Seats bought, and the season they open. */
export interface Expansion {
  readonly seats: number
  /** The `startYear` of the season the seats are ready for. */
  readonly readyYear: number
}

export interface Score {
  readonly home: number
  readonly away: number
}

export interface Fixture {
  readonly id: FixtureId
  /** 1-based, 1–38. */
  readonly round: number
  readonly date: DayNumber
  readonly homeId: ClubId
  readonly awayId: ClubId
  /**
   * `null` means unplayed. Deliberately nullable rather than optional: with
   * `exactOptionalPropertyTypes`, "absent" and "present but null" are different
   * types, and an unplayed fixture is a real state a save must round-trip — not a
   * missing field.
   */
  readonly result: Score | null
}

export interface Competition {
  readonly id: string
  readonly name: string
  readonly clubIds: readonly ClubId[]
}

export interface Season {
  /** e.g. 2026 for the 2026/27 season. */
  readonly startYear: number
  /** The day clock. Advanced only by the tick; never derived from wall time. */
  readonly currentDate: DayNumber
  readonly fixtures: readonly Fixture[]
}

export function isPlayed(fixture: Fixture): boolean {
  return fixture.result !== null
}
