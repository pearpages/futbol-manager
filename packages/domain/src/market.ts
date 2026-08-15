import { acceptableYears } from './bids.ts'
import type { ClubId, Ledger } from './entities.ts'
import { credit, FINANCE } from './finance.ts'
import { bestXI, FORMATIONS, keepsLineup, startersOf, teamRating } from './lineup.ts'
import { ageOn, contractExpiry, overall, type Player, type PlayerId, POSITIONS } from './player.ts'
import { type Rng, shuffle } from './rng.ts'
import type { GameState } from './state.ts'
import { type DayNumber, toCivil } from './time.ts'
import { askingPrice, expectedWage } from './valuation.ts'

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

/**
 * The window opening or closing between two dates, or null if nothing changed.
 *
 * The window is a predicate over the date rather than a stored flag, so an opening
 * is a *change across two dates* — there is no moment the market itself fires.
 *
 * Both callers matter. The day tick crosses 31 Dec → 1 Jan and 31 Jan → 1 Feb; the
 * **summer opening is only ever reached by `StartNewSeason`**, which jumps from the
 * end of the season straight to 15 August and never sets foot in July. Watching only
 * the tick would announce January and silently miss every summer — the same trap the
 * `toCivil(today).d === 1` gate fell into at M4c.
 */
export function transferWindowChange(from: DayNumber, to: DayNumber): boolean | null {
  const open = isTransferWindowOpen(to)
  return open === isTransferWindowOpen(from) ? null : open
}

/** Squad floor. A club will not sell below this. */
export const MIN_SQUAD = 18
/** Above this a club stops buying regardless — a backstop, not the mechanism. */
export const MAX_SQUAD = 30

/**
 * A need below this is noise; acting on it produces churn for its own sake.
 *
 * `needFor` returns whole numbers, so this reads as **"at least 1"** — the
 * fraction buys nothing. Moving it to 0.3 or 0.6 changes no decision in the game.
 */
const NEED_THRESHOLD = 0.4

/** How much rating gain a club demands per unit of value spent. */
const VALUE_FOR_MONEY = 0.0016

export interface Transfer {
  readonly playerId: PlayerId
  /**
   * `null` when the player came out of the free-agent pool. There is no selling
   * club, so there is nobody to pay — which is exactly why a free agent is the
   * one thing a club with no money can still do something about.
   */
  readonly from: ClubId | null
  readonly to: ClubId
  readonly fee: number
}

/**
 * Terms a club offers a free agent. Deterministic, because `applyTransfers` has
 * no rng and must not acquire one — it runs inside the reducer's day pipeline.
 */
function freeAgentContract(player: Player, startYear: number, date: DayNumber) {
  const years = Math.min(3, acceptableYears(ageOn(player, date)).max)
  return { until: contractExpiry(startYear + years), wage: expectedWage(player, date) }
}

/**
 * How much better this club's XI would be with `candidate` in it.
 *
 * The whole scoring function, and the market's single question — asked in both
 * directions. `runTransferWindow` asks whether a club wants a player,
 * `rolloverSeason` asks whether it still wants one whose contract is up, and
 * `bestOfferFor` asks whether it wants one of yours. Full write-up in
 * docs/market-model.md.
 *
 * Three things that surprise people, in rough order of how often:
 *
 * **Zero is the normal answer, not a bug.** A player who would not displace
 * anyone adds nothing, however good he is in the abstract — he would sit on the
 * bench. A strong club scores zero on the entire market, and that is correct. It
 * is also why there is no rule against stockpiling goalkeepers: a second good
 * keeper cannot enter the XI, so he scores zero on his own.
 *
 * **It always evaluates in 4-4-2**, whatever formation the club plays. Deliberate
 * — one fixed shape keeps the score about the player rather than about a
 * formation change — but it makes the number an approximation under 4-3-3 or
 * 3-5-2.
 *
 * **The result is always a whole number.** `teamRating` runs `clampRating`, which
 * rounds, so both sides of the subtraction are integers. Every threshold compared
 * against this therefore collapses to an integer cutoff — see the constants in
 * this file and in `season.ts`, which are written as fractions and are not as
 * finely tuned as they look.
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

/**
 * The manager's listed players who are *currently* sellable.
 *
 * `surplus` is applied again here rather than trusted from when the button was
 * pressed. A player listed in August may be a starter by January — an injury to
 * the man ahead of him, a sale elsewhere — and selling him then would break up an
 * XI the manager chose on purpose. Listing says "I would let him go", not "sell
 * him whatever happens".
 */
export function listedForSale(state: GameState): Player[] {
  if (state.transferList.length === 0) return []
  const listed = new Set<PlayerId>(state.transferList)
  return surplus(state.squads[state.managedClubId] ?? []).filter((player) => listed.has(player.id))
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
export interface TransferWindowOptions {
  /**
   * The club the AI does not play. This is the human's.
   *
   * **It excludes him as a buyer, not as a seller.** Left out entirely, the AI
   * buys over the top of the manager; excluded from both roles — which is how M4b
   * shipped — nothing he owns is ever in front of a buyer, so selling is
   * impossible by construction. What he puts on the transfer list, and only that,
   * goes on the market.
   *
   * Optional, and unset by default, because `simulateCareer` is deliberately the
   * *no-human* instrument — M4a's ten-season measurements only mean what they say
   * if all twenty clubs are still played by the AI.
   */
  readonly exclude?: ClubId
}

export function runTransferWindow(
  state: GameState,
  rng: Rng,
  options: TransferWindowOptions = {},
): Transfer[] {
  const date = state.season.currentDate
  const transfers: Transfer[] = []

  const squads = new Map<ClubId, Player[]>(
    state.clubs.map((club) => [club.id, [...(state.squads[club.id] ?? [])]]),
  )
  const budgets = new Map<ClubId, number>(state.clubs.map((club) => [club.id, club.budget]))
  const pool = new Set<PlayerId>(state.freeAgents.map((player) => player.id))

  // Everything available this window, with the club that holds each player —
  // `null` for the free-agent pool, which belongs to nobody.
  const listed: { player: Player; from: ClubId | null }[] = []
  for (const club of state.clubs) {
    if (club.id === options.exclude) continue
    for (const player of surplus(squads.get(club.id) ?? [])) {
      listed.push({ player, from: club.id })
    }
  }
  // The manager's own contribution is exactly what he put up for sale. An AI club
  // offers a whole squad's worth of spares automatically; he offers a list.
  if (options.exclude !== undefined) {
    for (const player of listedForSale(state)) listed.push({ player, from: options.exclude })
  }
  for (const player of state.freeAgents) listed.push({ player, from: null })

  const order = shuffle(state.clubs, rng)

  for (const club of order) {
    if (club.id === options.exclude) continue
    const squad = squads.get(club.id)
    /* c8 ignore next */
    if (squad === undefined) continue
    if (squad.length >= MAX_SQUAD) continue

    // Score everything on the market for this club, best value first.
    //
    // Value is need per unit of **total cost — fee plus wages**, not per unit of
    // fee. Ranking on the fee alone divides by zero for a free agent, and papering
    // over that with `Math.max(1, fee)` gives him an unbeatable ratio: with a
    // one-signing-per-window rule, every club took a free agent every time and a
    // player with any price on his head was never bought at all. That silently
    // made selling impossible for the human, since the pool is never empty.
    //
    // A free agent is not free. He is a wage, which is exactly what a club weighs
    // him against — and no money moves either way, so conservation is untouched.
    const candidates = listed
      .filter((entry) => entry.from !== club.id)
      .map((entry) => {
        const fee = entry.from === null ? 0 : askingPrice(entry.player, date)
        return {
          ...entry,
          fee,
          need: needFor(squad, entry.player),
          cost: Math.max(1, fee + expectedWage(entry.player, date)),
        }
      })
      .filter((entry) => entry.need > NEED_THRESHOLD)
      .filter((entry) => entry.need / entry.cost > VALUE_FOR_MONEY)
      .sort((a, b) => b.need / b.cost - a.need / a.cost)

    // One paid signing and one free transfer, tracked separately.
    //
    // A single "one signing per window" cap crowds out every paid deal: a free
    // agent is always better value than anyone with a price on his head, so with
    // one slot a club takes a free agent every time, and the pool is never empty.
    // Nobody would ever have bought a listed player again — including the human's.
    //
    // Two counters rather than a bigger cap, because they really are different
    // resources: a free transfer does not touch the transfer budget, so it is not
    // competing with a fee for the same money. The paid rate is unchanged from
    // M4a, which is what keeps the career harness comparable.
    let paid = false
    let free = false

    for (const candidate of candidates) {
      if (paid && free) break
      if (candidate.from === null ? free : paid) continue

      // **The AI never borrows to buy.** Debt exists at M5a, but a club only
      // drifts into it through wages outrunning income — which is the failure the
      // exit criterion is actually hunting. Letting the AI spend into the
      // overdraft as well would put two causes behind the same symptom and make
      // "no club goes bankrupt" impossible to attribute.
      const buyer = budgets.get(club.id) ?? 0
      const outlay = candidate.fee + Math.round(candidate.fee * FINANCE.SIGNING_BONUS)
      if (buyer < outlay) continue

      if (candidate.from === null) {
        if (!pool.has(candidate.player.id)) continue // someone signed him first
        pool.delete(candidate.player.id)
      } else {
        const sellerSquad = squads.get(candidate.from)
        /* c8 ignore next */
        if (sellerSquad === undefined) continue
        if (sellerSquad.length <= MIN_SQUAD) continue
        if (!sellerSquad.some((p) => p.id === candidate.player.id)) continue // already sold
        // Re-checked against the squad *as it stands now*, not as it stood when
        // `listed` was built. Two of a club's forwards can each be spareable on
        // their own and leave it with two between them — which is a squad that
        // cannot field a 4-3-3, and the career harness says that must never happen.
        if (!canSpare(sellerSquad, candidate.player)) continue

        squads.set(
          candidate.from,
          sellerSquad.filter((p) => p.id !== candidate.player.id),
        )
        budgets.set(candidate.from, (budgets.get(candidate.from) ?? 0) + candidate.fee)
      }

      transfers.push({
        playerId: candidate.player.id,
        from: candidate.from,
        to: club.id,
        fee: candidate.fee,
      })

      // Apply immediately so later clubs see a market that has moved.
      budgets.set(club.id, buyer - outlay)
      squad.push(candidate.player)

      const index = listed.findIndex((e) => e.player.id === candidate.player.id)
      if (index >= 0) listed.splice(index, 1)

      // Capping each kind at one keeps a rich club from emptying the market in a
      // single pass, and spreads business across the league.
      if (candidate.from === null) free = true
      else paid = true

      if (squad.length >= MAX_SQUAD) break
    }
  }

  return transfers
}

/**
 * Applies transfers to state.
 *
 * A fee moves between two clubs and nets to zero across the league. **The
 * signing bonus does not** — it is paid to the player, so it leaves the league
 * entirely, and it is the reason a transfer is no longer a closed movement. Both
 * are recorded on the buyer's and seller's ledgers, which is what keeps the
 * balance identity checkable per club rather than only in aggregate.
 */
export function applyTransfers(state: GameState, transfers: readonly Transfer[]): GameState {
  if (transfers.length === 0) return state

  const squads: Record<string, Player[]> = {}
  for (const club of state.clubs) squads[club.id] = [...(state.squads[club.id] ?? [])]
  const budgets = new Map<ClubId, number>(state.clubs.map((c) => [c.id, c.budget]))
  const ledgers = new Map<ClubId, Ledger>(state.clubs.map((c) => [c.id, c.ledger]))

  const record = (clubId: ClubId, key: keyof Ledger, amount: number) => {
    const ledger = ledgers.get(clubId)
    if (ledger !== undefined) ledgers.set(clubId, credit(ledger, key, amount))
  }
  let freeAgents = [...state.freeAgents]
  // Only these get their lineup re-picked. Re-picking every club wiped out a human
  // manager's hand-chosen XI every time any two other clubs did business.
  const touched = new Set<ClubId>()

  for (const transfer of transfers) {
    const to = squads[transfer.to]
    /* c8 ignore next */
    if (to === undefined) continue

    let player: Player | undefined

    if (transfer.from === null) {
      player = freeAgents.find((p) => p.id === transfer.playerId)
      /* c8 ignore next */
      if (player === undefined) continue
      freeAgents = freeAgents.filter((p) => p.id !== transfer.playerId)
      // A free agent is out of contract by definition, so he arrives on new terms.
      // Leaving the expired one in place would value him at zero forever and let
      // him be flipped between clubs for nothing, every window.
      player = {
        ...player,
        contract: freeAgentContract(player, state.season.startYear, state.season.currentDate),
      }
    } else {
      const from = squads[transfer.from]
      /* c8 ignore next */
      if (from === undefined) continue
      player = from.find((p) => p.id === transfer.playerId)
      /* c8 ignore next */
      if (player === undefined) continue

      squads[transfer.from] = from.filter((p) => p.id !== transfer.playerId)
      budgets.set(transfer.from, (budgets.get(transfer.from) ?? 0) + transfer.fee)
      record(transfer.from, 'transfers', transfer.fee)
      touched.add(transfer.from)
    }

    // A free transfer still carries a bonus: no fee changes hands, but the player
    // is paid to sign, which is exactly why a free agent is not costless.
    const bonus = Math.round(transfer.fee * FINANCE.SIGNING_BONUS)
    to.push(player)
    budgets.set(transfer.to, (budgets.get(transfer.to) ?? 0) - transfer.fee - bonus)
    record(transfer.to, 'transfers', -transfer.fee)
    if (bonus > 0) record(transfer.to, 'bonuses', bonus)
    touched.add(transfer.to)
  }

  const clubs = state.clubs.map((club) => ({
    ...club,
    budget: budgets.get(club.id) ?? club.budget,
    ledger: ledgers.get(club.id) ?? club.ledger,
  }))

  // A club whose squad changed needs its lineup re-picked, or a sold player stays
  // in the starting eleven and the resolver reads a squad that no longer contains
  // him. The managed club is the exception: the manager picked that XI on purpose,
  // so it is only rebuilt when the transfer has actually made it illegal.
  const lineups = { ...state.lineups }
  for (const clubId of touched) {
    const squad = squads[clubId] ?? []
    if (squad.length < 11) continue
    const formation = state.lineups[clubId]?.formation ?? '4-4-2'

    if (clubId === state.managedClubId && keepsLineup(squad, state.lineups[clubId])) continue
    lineups[clubId] = bestXI(squad, formation)
  }

  // A sold player comes off the transfer list, or it slowly fills with the ids of
  // players who left years ago.
  const own = new Set<PlayerId>((squads[state.managedClubId] ?? []).map((p) => p.id))
  const transferList = state.transferList.filter((id) => own.has(id))

  return { ...state, clubs, squads, lineups, freeAgents, transferList }
}

/**
 * Total money in the league.
 *
 * **This was constant for a whole career until M5a, and is not any more.**
 * Revenue creates money and wages destroy it, so the old "a transfer moves it,
 * nothing creates it" invariant has been replaced rather than dropped: every
 * movement is now a ledger line, and `ledgerNet` over a club's season must equal
 * the change in its balance exactly. That is a stricter test, not a looser one —
 * the old one said the league had inflated, the new one says which club and on
 * which line. See `finance.ts` and ADR 0009.
 */
export function totalBudget(state: GameState): number {
  return state.clubs.reduce((sum, club) => sum + club.budget, 0)
}
