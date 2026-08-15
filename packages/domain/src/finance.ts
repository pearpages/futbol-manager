import type { Club, ClubId, Fixture, Ledger } from './entities.ts'
import type { Player } from './player.ts'
import { computeTable } from './table.ts'
import { toCivil, type DayNumber } from './time.ts'

/**
 * Where the money comes from, and where it goes.
 *
 * Until M5a money only ever moved *between* clubs: `totalBudget` was closed and
 * constant, so a budget was a one-time allowance rather than an income. Over a
 * decade that is a ratchet — the three richest clubs ended up holding 21.5M of
 * the league's 27.9M while the poorest sat at single-digit thousands, and a small
 * club eventually could not buy anybody. Revenue is what turns it into a cycle.
 *
 * **Every function here is deterministic, and that is a requirement rather than
 * a preference.** Finance runs inside `AdvanceDay`, which is the path every
 * calibrated distribution band in the project is measured through. One
 * `rng.next()` on this path shifts every downstream draw and moves every band —
 * the same discipline the bid subsystem is held to, for the same reason. If a
 * band ever moves after a change here, something drew randomness that should not
 * have: find it, do not widen the band.
 *
 * All figures are thousands, like the rest of the money in this codebase.
 */

/**
 * The lines of a season's accounts, and their sign in the balance identity.
 *
 * Written once here so the invariant can be checked by iterating rather than by
 * naming eight fields at every call site — which is how a ninth line would
 * silently escape the check.
 */
export const LEDGER_KEYS = [
  'gate',
  'tv',
  'sponsor',
  'prize',
  'transfers',
  'wages',
  'bonuses',
  'interest',
  'stadium',
] as const

const OUTGOINGS = new Set<keyof Ledger>(['wages', 'bonuses', 'interest', 'stadium'])

export const EMPTY_LEDGER: Ledger = {
  gate: 0,
  tv: 0,
  sponsor: 0,
  prize: 0,
  transfers: 0,
  wages: 0,
  bonuses: 0,
  interest: 0,
  stadium: 0,
}

/**
 * What a ledger nets out to — income minus outgoings.
 *
 * This is the whole balance invariant: a club's budget moves by exactly this
 * much over a season, and by nothing else.
 */
export function ledgerNet(ledger: Ledger): number {
  let net = 0
  for (const key of LEDGER_KEYS) {
    net += OUTGOINGS.has(key) ? -ledger[key] : ledger[key]
  }
  return net
}

/** Adds one line to a ledger. Lines are always positive; the sign is the key. */
export function credit(ledger: Ledger, key: keyof Ledger, amount: number): Ledger {
  return { ...ledger, [key]: ledger[key] + amount }
}

// ── The model ───────────────────────────────────────────────────────────────

/**
 * The knobs. Grouped rather than scattered because M5 is a tuning milestone —
 * the roadmap says so twice — and a constant you cannot find is a constant you
 * cannot tune.
 */
export const FINANCE = {
  /**
   * Per seat, per home match — the league default, and what every AI club
   * charges. M5b made it a `Club` field the manager can move.
   *
   * **The overdraft is still sized on this figure, never on the price a manager
   * sets.** `annualIncome` feeds `debtLimit`; if it followed the slider, raising
   * your own ticket price would raise your own borrowing limit, which is a club
   * lending itself money.
   *
   * **Doubled from 0.0069 when the grounds became real.** M5a calibrated this
   * against a league of 1.20M seats, invented by a curve on rating; real Spanish
   * grounds hold 776k, and the cut fell hardest on the middle — Girona lost 71% of
   * its seats, Getafe 59%. Two clubs went into a permanent debt spiral: income
   * below the wage bill, 12% interest compounding, and the squad degrading too
   * slowly to catch up. Restoring the league's *aggregate* gate income (1.54×) did
   * not fix them, because their own grounds fell far further than the average.
   *
   * At 2× both arms of the human harness clear their overdrafts with the worst
   * club at 0.17× its limit, and the league total lands at 2.30× over fifty
   * seasons against 2.15× before — `WAGE_INFLATION` taxes the extra income back,
   * which is the brake working as designed. €13.80 a seat is also the more
   * plausible figure; €6.90 was a number chosen to balance imaginary stadiums.
   */
  TICKET: 0.0138,
  /** How far a manager may move the price, as a multiple of the default. */
  MIN_TICKET_FACTOR: 0.4,
  MAX_TICKET_FACTOR: 2.5,
  /**
   * How much a dearer ticket empties the ground.
   *
   * Applied to the ratio against the default, so charging the default changes
   * nothing at all — the same "inert when unused" property that let M3c's tempo
   * and M5a's finance extend a calibrated model without moving a band.
   *
   * **The value is what puts the best price inside the range rather than at the
   * end of it.** Gate takings are `price × (1 − s(price/default − 1))`, which
   * peaks at `(1 + s) / 2s` times the default — 1.5× here. Any weaker and the
   * peak sits beyond `MAX_TICKET_FACTOR`, which makes "charge the maximum"
   * strictly correct and the slider a button. That is the same exploit the
   * tactics slider had at M3a, arriving by a different route.
   */
  PRICE_SENSITIVITY: 0.5,
  /** What a seat costs to build. */
  SEAT_COST: 0.55,
  /** The smallest and largest expansion worth the paperwork. */
  MIN_EXPANSION: 1_000,
  MAX_EXPANSION: 15_000,
  /** Floor and ceiling on how full a ground gets, whatever the form. */
  MIN_OCCUPANCY: 0.45,
  MAX_OCCUPANCY: 0.98,
  /** The league's television money for a season, before it is split. */
  TV_POOL: 78_000,
  /** How much of that pool is shared equally; the rest goes on merit. */
  TV_EQUAL_SHARE: 0.3,
  /** Sponsorship for a club of exactly average rating, per season. */
  BASE_SPONSOR: 1_215,
  SPONSOR_EXPONENT: 3.2,
  /** The season's prize fund, before the position ladder splits it. */
  PRIZE_POOL: 26_000,
  /** How steeply prize money falls from first to twentieth. */
  PRIZE_DECAY: 0.88,
  /** Paid to the player on signing, as a fraction of the fee. Leaves the league. */
  SIGNING_BONUS: 0.1,
  /**
   * How hard a cash pile pushes up what a club pays its players.
   *
   * **This is the brake on "an unspendable fortune", and it needs one.** A fixed
   * surplus compounds without limit, because the league's only other outflow is
   * the signing bonus and transfer volume falls to nothing once squads converge —
   * measured at zero from about season fifteen of a career. So the outflow cannot
   * be a constant; it has to grow with the pile.
   *
   * Wages are where it belongs rather than an invented "expenses" line: a club
   * sitting on money pays over the odds to keep and attract players, which is
   * both what happens and a cost the game already models.
   */
  WAGE_INFLATION: 1.8,
  /**
   * Years of income a club may bank before the premium starts.
   *
   * Without it the premium taxes the opening balance too, and a career began by
   * vaporising four fifths of the league's money in its first season — which
   * would quietly undo M4b's calibration that a budget buys two players of the
   * club's own standard. A reserve is not a fortune.
   */
  HEALTHY_RESERVE: 0.75,
  /** Beyond this much banked *above* the reserve, the premium stops growing. */
  WAGE_INFLATION_CAP: 3,
  /** Annual, charged monthly, on an overdrawn balance. */
  INTEREST_RATE: 0.12,
  /** How much debt a club may carry, as a fraction of one season's income. */
  DEBT_LIMIT: 0.5,
} as const

/*
 * There is no `seedCapacity` here any more, and that is deliberate.
 *
 * Seats used to be derived from rating on the same convex curve the budget uses.
 * It was a reasonable guess and it was wrong twice over: it put 1.20M seats in a
 * league that has 776k, and it made capacity a second copy of the rating, when in
 * real football a ground is the one thing about a club that is inherited rather
 * than earned. Capacity is now literal data, carried per club in `CLUBS` in
 * `@fm/data` and mirrored in `test-clubs.ts`.
 *
 * `migrations.ts` keeps its own frozen copy of the old curve (`v6ToV7`), as it must
 * — a migration records what a version meant when it shipped. Deleting this
 * function cannot disturb an existing save.
 *
 * A second division at M7 may want a generator again. Write it then, against two
 * real cases; ground rule 5.
 */

/**
 * How full the ground gets: quality fills seats, and so does winning.
 *
 * Position is passed in rather than computed here so that a caller walking every
 * fixture on a matchday computes the table once. `position` is 1-based; `null`
 * means the season has not started and only quality is doing the work.
 */
export function occupancy(club: Club, position: number | null, clubCount: number): number {
  const rating = (club.attack + club.defence) / 2
  // A rating of 50 sits mid-scale; the good clubs fill up, the poor ones do not.
  const fromQuality = 0.5 + (rating - 70.03) / 49.93
  // Top of the table adds, bottom subtracts, and it is worth less than quality —
  // a big club with a bad season still draws a bigger crowd than a small one.
  const fromForm =
    position === null || clubCount <= 1 ? 0 : 0.16 * (1 - (2 * (position - 1)) / (clubCount - 1))
  // The floor and ceiling bound how much *quality and form* can do. Price is
  // applied afterwards, as a multiplier, and deliberately not floored with them:
  // folding it in let `MIN_OCCUPANCY` absorb the damage, so charging the maximum
  // came out strictly best and the slider had one right answer at its end stop.
  const base = Math.min(
    FINANCE.MAX_OCCUPANCY,
    Math.max(FINANCE.MIN_OCCUPANCY, fromQuality + fromForm),
  )

  // One at the default price, by construction — a club that never touches the
  // slider gets exactly the M5a model back, which is why no band moved.
  const priced = 1 - FINANCE.PRICE_SENSITIVITY * (club.ticketPrice / FINANCE.TICKET - 1)

  return base * Math.max(0.05, priced)
}

/** What one home match takes at the gate. */
export function gateReceipts(club: Club, position: number | null, clubCount: number): number {
  return Math.round(club.capacity * occupancy(club, position, clubCount) * club.ticketPrice)
}

/** What buying this many seats costs. */
export function expansionCost(seats: number): number {
  return Math.round(seats * FINANCE.SEAT_COST)
}

/**
 * A season's television money: half shared equally, half on last season's finish.
 *
 * The equal share is what keeps a promoted or struggling club solvent; the merit
 * half is what stops the league flattening into twenty identical economies.
 * `position` is last season's, or `null` in the first season of a career — where
 * every club takes the equal share and nothing else, which is the same money in
 * the league and simply spread flat.
 */
export function tvMoney(position: number | null, clubCount: number): number {
  const equal = (FINANCE.TV_POOL * FINANCE.TV_EQUAL_SHARE) / clubCount
  if (position === null)
    return Math.round(equal + (FINANCE.TV_POOL * (1 - FINANCE.TV_EQUAL_SHARE)) / clubCount)

  // Merit share falls linearly from first to last, summing back to the pool.
  const merit = FINANCE.TV_POOL * (1 - FINANCE.TV_EQUAL_SHARE)
  const weight = clubCount - position + 1
  const total = (clubCount * (clubCount + 1)) / 2
  return Math.round(equal + (merit * weight) / total)
}

/** A season's sponsorship, on the club's standing rather than its results. */
export function sponsorMoney(club: Club): number {
  const rating = (club.attack + club.defence) / 2
  return Math.round(
    FINANCE.BASE_SPONSOR * Math.pow((rating - 45.08) / 24.96, FINANCE.SPONSOR_EXPONENT),
  )
}

/**
 * Prize money by final position, as a geometric ladder over the pool.
 *
 * Deliberately its own ladder rather than the app's qualification `BANDS`:
 * `domain` cannot import from `app` (the direction is enforced), and ground rule
 * 5 says a shared ladder waits for the second case, which is M7's second
 * division and continental places.
 */
export function prizeMoney(position: number, clubCount: number): number {
  // Normalise so the twenty shares sum to the pool exactly, whatever the decay.
  let total = 0
  for (let i = 0; i < clubCount; i++) total += Math.pow(FINANCE.PRIZE_DECAY, i)
  return Math.round((FINANCE.PRIZE_POOL * Math.pow(FINANCE.PRIZE_DECAY, position - 1)) / total)
}

/** The squad's annual wage bill. */
export function wageBill(squad: readonly Player[]): number {
  return squad.reduce((sum, player) => sum + player.contract.wage, 0)
}

/**
 * Roughly what a club takes in over a season, used to size its overdraft.
 *
 * An estimate rather than a measurement: the limit has to exist before the
 * season it covers has been played. Gate assumes a mid-table finish over 19 home
 * games, which is the point of the exercise — a limit that moved with form would
 * tighten exactly when a club could least afford it.
 */
export function annualIncome(club: Club, clubCount: number, homeGames: number): number {
  // Priced at the league default rather than at this club's own ticket price —
  // see `FINANCE.TICKET`. A manager must not be able to widen his overdraft by
  // moving a slider.
  const atDefault = { ...club, ticketPrice: FINANCE.TICKET }
  const gate = gateReceipts(atDefault, Math.ceil(clubCount / 2), clubCount) * homeGames
  return gate + tvMoney(null, clubCount) + sponsorMoney(club)
}

/**
 * How far below zero a club may go.
 *
 * Proportional to its own income rather than a flat figure: a flat limit is
 * pocket change to the richest club and fatal to the poorest, which would make
 * the exit criterion a statement about one club rather than about the league.
 */
export function debtLimit(club: Club, clubCount: number, homeGames: number): number {
  return Math.round(annualIncome(club, clubCount, homeGames) * FINANCE.DEBT_LIMIT)
}

/** True when the club has room to spend this much. Debt is allowed; the limit is not. */
export function canAfford(
  club: Club,
  amount: number,
  clubCount: number,
  homeGames: number,
): boolean {
  return club.budget - amount >= -debtLimit(club, clubCount, homeGames)
}

/**
 * What signing a player actually takes out of the bank: the fee, plus the bonus
 * the player is paid for putting his name to it.
 *
 * Stated once because two places have to agree on it. The reducer refuses a bid
 * it cannot cover, and the market screen filters on affordability — and a screen
 * filtering on the fee alone offers you players the reducer will then reject,
 * which is the manager finding out about the bonus by being refused.
 */
export function signingOutlay(fee: number): number {
  return fee + Math.round(fee * FINANCE.SIGNING_BONUS)
}

// ── The monthly tick ────────────────────────────────────────────────────────

/** Wages, TV, sponsorship and interest all settle on the first of the month. */
export function isSettlementDay(date: DayNumber): boolean {
  return toCivil(date).d === 1
}

/**
 * One club's month. Returns the lines to add, never a mutated club.
 *
 * Interest is charged on the balance *before* this month's movements, so a club
 * is not billed for a deficit the same tick that creates it.
 */
export function monthlyLines(
  club: Club,
  squad: readonly Player[],
  lastPosition: number | null,
  clubCount: number,
  homeGames: number,
): {
  readonly tv: number
  readonly sponsor: number
  readonly wages: number
  readonly interest: number
} {
  return {
    tv: Math.round(tvMoney(lastPosition, clubCount) / 12),
    sponsor: Math.round(sponsorMoney(club) / 12),
    wages: Math.round((wageBill(squad) * wagePremium(club, clubCount, homeGames)) / 12),
    interest: club.budget < 0 ? Math.round((-club.budget * FINANCE.INTEREST_RATE) / 12) : 0,
  }
}

/**
 * What a club pays over the odds because it is sitting on money.
 *
 * One in a healthy club, rising toward `1 + WAGE_INFLATION × WAGE_INFLATION_CAP`
 * for one that has banked several years of income. This is the negative feedback
 * that bounds the economy: without it a club in surplus stays in surplus and the
 * league total compounds forever, which measured at 36× over fifty seasons.
 *
 * **Inert for a club in debt or living hand to mouth**, which is the property
 * that matters — it changes nothing about a struggling club's problem, and only
 * bites the one the exit criterion is worried about.
 */
export function wagePremium(club: Club, clubCount: number, homeGames: number): number {
  if (club.budget <= 0) return 1
  const years = club.budget / Math.max(1, annualIncome(club, clubCount, homeGames))
  const excess = Math.max(0, years - FINANCE.HEALTHY_RESERVE)
  return 1 + FINANCE.WAGE_INFLATION * Math.min(excess, FINANCE.WAGE_INFLATION_CAP)
}

/**
 * The finishing order of a completed season, as club id → 1-based position.
 *
 * Returns `null` when nothing has been played, which is what the first season of
 * a career looks like and why every consumer takes a nullable position.
 */
export function positionsFrom(
  clubIds: readonly ClubId[],
  fixtures: readonly Fixture[],
): ReadonlyMap<ClubId, number> | null {
  if (!fixtures.some((f) => f.result !== null)) return null
  const table = computeTable(clubIds, fixtures)
  return new Map(table.map((row, index) => [row.clubId, index + 1]))
}

// ── The forecast ────────────────────────────────────────────────────────────

/** A whole season's recurring money, in thousands. Not a measurement. */
export interface Projection {
  readonly gate: number
  readonly tv: number
  readonly sponsor: number
  readonly prize: number
  /** The bill, including whatever premium a cash pile is adding to it. */
  readonly wages: number
  /** Income minus wages. */
  readonly net: number
  /**
   * The league position it was computed at, or `null` before a ball is kicked —
   * so a screen can say the forecast is standing on an assumption.
   */
  readonly position: number | null
}

/**
 * What a full season looks like at today's squad, ticket price and position.
 *
 * **A run rate, deliberately, rather than "banked so far plus what is left".**
 * The question it answers is "can I afford this squad", and that is a comparison
 * between a whole year's income and a whole year's wages. Mixing actuals into it
 * would make the figure lurch every home match and mean something different in
 * May than in August, when the accounts table beside it already states actuals.
 *
 * **It must not reuse `annualIncome`.** That function deliberately prices the
 * gate at the league default and assumes a mid-table finish, because it sizes the
 * overdraft and a manager must not widen his own borrowing with the ticket
 * slider. A forecast has the opposite duty: it is *his* price and *his* position
 * or it is not telling him anything.
 *
 * Every nullable position is handled by the convention that already exists for
 * it — `occupancy` drops the form term, `tvMoney` pays the flat share. Only prize
 * money has no such convention, so it falls back to a mid-table finish, which is
 * the same assumption `annualIncome` makes for the same reason.
 */
export function seasonProjection(
  club: Club,
  squad: readonly Player[],
  clubIds: readonly ClubId[],
  fixtures: readonly Fixture[],
): Projection {
  const clubCount = clubIds.length
  const position = positionsFrom(clubIds, fixtures)?.get(club.id) ?? null
  // Counted rather than taken from `ROUNDS_PER_HALF`, so a competition with a
  // different shape needs no second constant kept in step with this one.
  const homeGames = fixtures.filter((f) => f.homeId === club.id).length

  const gate = gateReceipts(club, position, clubCount) * homeGames
  const tv = tvMoney(position, clubCount)
  const sponsor = sponsorMoney(club)
  const prize = prizeMoney(position ?? Math.ceil(clubCount / 2), clubCount)
  // The premium is part of the answer, not a detail: the panel exists because the
  // raw contractual bill is not what a club actually pays.
  const wages = Math.round(wageBill(squad) * wagePremium(club, clubCount, homeGames))

  return {
    gate,
    tv,
    sponsor,
    prize,
    wages,
    net: gate + tv + sponsor + prize - wages,
    position,
  }
}
