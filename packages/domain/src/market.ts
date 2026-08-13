import type { Club, ClubId } from './entities.ts'
import { bestXI, FORMATIONS, startersOf, teamRating } from './lineup.ts'
import { overall, type Player, type PlayerId, POSITIONS } from './player.ts'
import type { Rng } from './rng.ts'
import type { GameState } from './state.ts'
import { type DayNumber, toCivil } from './time.ts'
import { askingPrice } from './valuation.ts'

/**
 * The AI transfer market.
 *
 * The roadmap is emphatic about the shape: **a scoring function over squad needs,
 * not a rule tree** — "rule trees in transfer markets produce clubs that stockpile
 * goalkeepers."
 *
 * So there is no rule about how many keepers a club may own. Instead, a club's
 * need at a position is the **marginal gain in its team rating** from improving
 * that slot. Once it has a good keeper, a second one cannot enter the XI and
 * therefore adds nothing, so the need score collapses to zero on its own. Squad
 * sizes are likewise a *consequence* of needs falling away rather than a cap —
 * a cap would hide exactly the bug the exit criterion is hunting for.
 */

/** Deals only happen inside a window, as in reality. */
export function isTransferWindowOpen(date: DayNumber): boolean {
  const { m } = toCivil(date)
  return m === 7 || m === 8 || m === 1
}

/** Squad floor. A club will not sell below this. */
export const MIN_SQUAD = 18
/** Above this a club stops buying regardless — a backstop, not the mechanism. */
export const MAX_SQUAD = 30

/** A need below this is noise; acting on it produces churn for its own sake. */
const NEED_THRESHOLD = 0.4

/** How much rating gain a club demands per unit of value spent. */
const VALUE_FOR_MONEY = 0.0016

export interface Transfer {
  readonly playerId: PlayerId
  readonly from: ClubId
  readonly to: ClubId
  readonly fee: number
}

/**
 * How much better this club's XI would be with `candidate` in it.
 *
 * The whole scoring function. Positive means the player would improve the team
 * rating; zero or below means he would sit on the bench and is worth nothing to
 * this club, however good he is in the abstract.
 */
export function needFor(squad: readonly Player[], candidate: Player): number {
  const before = ratingOf(squad)
  const after = ratingOf([...squad, candidate])
  return after - before
}

function ratingOf(squad: readonly Player[]): number {
  // 4-4-2 as the reference shape: comparing candidates under one formation keeps
  // the score about the player rather than about a formation change.
  const shape = FORMATIONS['4-4-2']
  for (const position of POSITIONS) {
    if (squad.filter((p) => p.position === position).length < shape[position]) return 0
  }
  const rating = teamRating(startersOf(squad, bestXI(squad, '4-4-2')))
  return rating.attack + rating.defence
}

/** Players a club would let go: those whose absence costs the XI nothing. */
export function surplus(squad: readonly Player[]): Player[] {
  if (squad.length <= MIN_SQUAD) return []
  const starting = new Set<PlayerId>(bestXI(squad, '4-4-2').starters)

  return squad
    .filter((player) => !starting.has(player.id))
    .filter((player) => canSpare(squad, player))
    .sort((a, b) => overall(a) - overall(b))
}

/** True when removing this player still leaves a legal XI in the reference shape. */
function canSpare(squad: readonly Player[], player: Player): boolean {
  const remaining = squad.filter((p) => p.id !== player.id)
  const shape = FORMATIONS['4-4-2']
  return POSITIONS.every(
    (position) => remaining.filter((p) => p.position === position).length >= shape[position] + 1,
  )
}

/**
 * One window's worth of business, as a list of transfers to apply.
 *
 * Clubs are served in a deliberately rotating order rather than always richest
 * first: a fixed order would let the same club take the pick of the market every
 * window and compound its advantage into a runaway.
 */
export function runTransferWindow(state: GameState, rng: Rng): Transfer[] {
  const date = state.season.currentDate
  const transfers: Transfer[] = []

  const squads = new Map<ClubId, Player[]>(
    state.clubs.map((club) => [club.id, [...(state.squads[club.id] ?? [])]]),
  )
  const budgets = new Map<ClubId, number>(state.clubs.map((club) => [club.id, club.budget]))

  // Everything available this window, with the club that holds each player.
  const listed: { player: Player; from: ClubId }[] = []
  for (const club of state.clubs) {
    for (const player of surplus(squads.get(club.id) ?? [])) {
      listed.push({ player, from: club.id })
    }
  }

  const order = shuffle(state.clubs, rng)

  for (const club of order) {
    const squad = squads.get(club.id)
    /* c8 ignore next */
    if (squad === undefined) continue
    if (squad.length >= MAX_SQUAD) continue

    // Score everything on the market for this club, best first.
    const options = listed
      .filter((entry) => entry.from !== club.id)
      .map((entry) => ({
        ...entry,
        need: needFor(squad, entry.player),
        fee: askingPrice(entry.player, date),
      }))
      .filter((entry) => entry.need > NEED_THRESHOLD)
      .filter((entry) => entry.need / Math.max(1, entry.fee) > VALUE_FOR_MONEY)
      .sort((a, b) => b.need / b.fee - a.need / a.fee)

    for (const option of options) {
      const buyer = budgets.get(club.id) ?? 0
      const sellerSquad = squads.get(option.from)
      /* c8 ignore next */
      if (sellerSquad === undefined) continue
      if (buyer < option.fee) continue
      if (sellerSquad.length <= MIN_SQUAD) continue
      if (!sellerSquad.some((p) => p.id === option.player.id)) continue // already sold

      transfers.push({
        playerId: option.player.id,
        from: option.from,
        to: club.id,
        fee: option.fee,
      })

      // Apply immediately so later clubs see a market that has moved.
      budgets.set(club.id, buyer - option.fee)
      budgets.set(option.from, (budgets.get(option.from) ?? 0) + option.fee)
      squads.set(
        option.from,
        sellerSquad.filter((p) => p.id !== option.player.id),
      )
      squad.push(option.player)

      const index = listed.findIndex((e) => e.player.id === option.player.id)
      if (index >= 0) listed.splice(index, 1)

      // One signing per club per window keeps a rich club from emptying the
      // market in a single pass, and spreads business across the league.
      break
    }
  }

  return transfers
}

/** Applies transfers to state. Money moves between clubs; none is created. */
export function applyTransfers(state: GameState, transfers: readonly Transfer[]): GameState {
  if (transfers.length === 0) return state

  const squads: Record<string, Player[]> = {}
  for (const club of state.clubs) squads[club.id] = [...(state.squads[club.id] ?? [])]
  const budgets = new Map<ClubId, number>(state.clubs.map((c) => [c.id, c.budget]))

  for (const transfer of transfers) {
    const from = squads[transfer.from]
    const to = squads[transfer.to]
    /* c8 ignore next */
    if (from === undefined || to === undefined) continue

    const player = from.find((p) => p.id === transfer.playerId)
    /* c8 ignore next */
    if (player === undefined) continue

    squads[transfer.from] = from.filter((p) => p.id !== transfer.playerId)
    to.push(player)
    budgets.set(transfer.from, (budgets.get(transfer.from) ?? 0) + transfer.fee)
    budgets.set(transfer.to, (budgets.get(transfer.to) ?? 0) - transfer.fee)
  }

  const clubs = state.clubs.map((club) => ({
    ...club,
    budget: budgets.get(club.id) ?? club.budget,
  }))

  // Any club whose XI was touched needs its lineup re-picked, or a sold player
  // stays in the starting eleven and the resolver reads a squad that no longer
  // contains him.
  const lineups = { ...state.lineups }
  for (const club of clubs) {
    const squad = squads[club.id] ?? []
    if (squad.length >= 11)
      lineups[club.id] = bestXI(squad, state.lineups[club.id]?.formation ?? '4-4-2')
  }

  return { ...state, clubs, squads, lineups }
}

/** Fisher–Yates over the injected rng — no `Math.random`, so a seed reproduces the market. */
function shuffle(clubs: readonly Club[], rng: Rng): Club[] {
  const result = [...clubs]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const a = result[i]
    const b = result[j]
    /* c8 ignore next */
    if (a === undefined || b === undefined) continue
    result[i] = b
    result[j] = a
  }
  return result
}

/** Total money in the league. A transfer moves it; nothing creates it. */
export function totalBudget(state: GameState): number {
  return state.clubs.reduce((sum, club) => sum + club.budget, 0)
}
