import { acceptableYears } from './bids.ts'
import type { ClubId, Ledger } from './entities.ts'
import { credit, FINANCE } from './finance.ts'
import {
  bestXI,
  DEEPEST_BANK,
  fieldableFormation,
  FORMATIONS,
  keepsLineup,
  type Lineup,
  startersOf,
  teamRatingRaw,
} from './lineup.ts'
import {
  ageOn,
  contractExpiry,
  overall,
  type Player,
  type PlayerId,
  type Position,
  POSITIONS,
} from './player.ts'
import { type Rng, shuffle } from './rng.ts'
import type { GameState } from './state.ts'
import { type DayNumber, daysBetween, fromCivil, toCivil } from './time.ts'
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

/**
 * Days of market left, counting today, or null when the window is shut.
 *
 * The window has no stored end — it is a predicate over the month — so the deadline
 * is derived: the first day of the month *after the window's last month*.
 *
 * **July and August are one window**, so a July date counts to 1 September, not to
 * 1 August. Taking "the month after this month" is the obvious rule and the wrong
 * one, and it looks right in every test that starts in August — which is all of them,
 * because the day clock never enters July. That is exactly what makes it cheap to
 * leave broken, so it has its own test.
 */
export function transferWindowDaysLeft(date: DayNumber): number | null {
  const { y, m } = toCivil(date)
  if (m === 7 || m === 8) return daysBetween(date, fromCivil(y, 9, 1))
  if (m === 1) return daysBetween(date, fromCivil(y, 2, 1))
  return null
}

/**
 * One warning, this many days before the deadline.
 *
 * The sentence that reports it takes `{count}` rather than saying "a week", so this
 * can move without leaving three dictionaries lying about it.
 */
export const WINDOW_WARNING_DAYS = 7

/** Squad floor. A club will not sell below this. */
export const MIN_SQUAD = 18
/** Above this a club stops buying regardless — a backstop, not the mechanism. */
export const MAX_SQUAD = 30

/**
 * A need below this is noise; acting on it produces churn for its own sake.
 *
 * This used to be a fiction: `needFor` returned whole numbers, so any value in
 * (0, 1] meant the same thing. It scores unrounded now, so the figure is real and
 * moving it by a tenth moves decisions.
 */
const NEED_THRESHOLD = 0.5

/**
 * How much rating gain a club demands per unit of value spent, **at the pivot**.
 *
 * The cap on what the AI will pay per point of improvement, and it is the single
 * reason money has never mattered to how the league plays. Measured on 2026-08-17
 * across TV pools of ×1.8 and ×2, equal shares of 0.3 and 0.5, sponsorship from
 * ×1.5 to ×2.5 and both ticket prices: **the AI league came out identical to the
 * decimal every time** — top five 3.74th, bottom five 16.20th, talent spread 34.5.
 * M4b recorded that as reassurance ("a career at 4×, 6× or 10× produces an
 * identical league"). Against the goal of a small club climbing, it is the
 * obstacle: extra income simply never becomes a transfer.
 */
const VALUE_FOR_MONEY = 0.0003

/**
 * The balance at which a club demands exactly `VALUE_FOR_MONEY`.
 *
 * **A rich club accepts worse value per point, which is what rich clubs do**, and
 * it is what finally turns income into transfers. Below the pivot the standard is
 * unchanged, so a poor club is no more reckless than it was.
 *
 * Set from the measured distribution rather than by feel. Swept at 3,000, 5,000,
 * 8,000 and 12,000 against transfers-per-season over a twelve-season career:
 * 18.0, 18.0, 17.1 and 14.2. Three thousand ties on volume and is the wrong
 * answer — every club in the division except the poorest clears it, so the split
 * stops meaning anything and this becomes a flat "everybody signs twice". Five
 * thousand puts about half the league on each side of it, which is the point.
 */
const WEALTH_PIVOT = 5_000

/**
 * Paid signings a club may make in one window, if it can afford the second.
 *
 * A cap rather than a rate: it stops one rich club taking the pick of the market
 * in a single pass, which is the same thing the rotating serving order guards.
 */
const MAX_PAID_SIGNINGS = 2

/** Free transfers a club may take in one window. Unchanged since M4c. */
const MAX_FREE_SIGNINGS = 1

/**
 * Fringe players a club abroad will let go in one window. See `runTransferWindow`.
 *
 * **One, and it was swept rather than picked**, because this number decides
 * whether money crosses the border in both directions or only one. Over twelve
 * seasons, players out of the domestic league against players in, and the net fee:
 *
 * | cap | in | out | net     |
 * | --- | -- | --- | ------- |
 * | 1   | 22 |  37 |  −15k   |
 * | 2   | 24 |  93 | −128k   |
 * | 3   | 25 | 147 | −206k   |
 * | 5   | 19 | 239 | −287k   |
 *
 * At one the flow is genuinely two-way and the net is under 4% of the league's
 * money. Above it the domestic league becomes a net importer of players and a net
 * exporter of cash, because these are the strongest clubs in Europe and their
 * `needFor` on a mid-table Spanish player is zero — the asymmetry is structural
 * and no amount of tuning elsewhere removes it.
 *
 * It also keeps abroad a slice of the market rather than the whole of it: 32
 * listings a season against roughly 120 at home. **The manager is not held to
 * this** — the club browser lets him bid for anyone abroad, at the premium.
 */
export const FOREIGN_LISTINGS = 1

/** What this club demands per unit spent, given what it is sitting on. */
function valueFloorFor(budget: number): number {
  return VALUE_FOR_MONEY * Math.min(1, WEALTH_PIVOT / Math.max(budget, 1))
}

/**
 * Premium per point of team rating the seller would lose. See `reluctancePremium`.
 *
 * Set from the measured spread rather than by feel: across the shipped twenty,
 * `loseCost` runs to a median of 0.35–0.65 for outfielders and a maximum of 4.2,
 * which is a goalkeeper — there is no depth at that position anywhere. At 0.6 an
 * ordinary starter adds a fifth to his price and the league's best keeper roughly
 * triples his, which is the right ordering: a keeper carries 35% of the defensive
 * rating on his own.
 */
const RELUCTANCE_SLOPE = 0.6

/** Flat premium for a player his club actually picked. See `reluctancePremium`. */
const IN_XI_PREMIUM = 1.5

/**
 * A ceiling, so that every player has a price — absurd, but finite.
 *
 * It does not bind anywhere in the shipped league: the highest premium measured is
 * ~5.0, on the best goalkeeper in the division. It is a backstop for M6, where an
 * injury crisis can leave a squad with one fit man at a position and push
 * `loseCost` far past anything seen today.
 */
const RELUCTANCE_CAP = 6

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
 * **The result is a fraction, and it did not used to be.** This scored off
 * `teamRating`, which rounds — so both sides of the subtraction were integers and
 * every threshold compared against it collapsed onto an integer cutoff. Four
 * constants written as 0.25, 0.4, 0.4 and 1.5 meant only "≥ 1" or "≥ 2", and looked
 * far more tuned than they were.
 *
 * It scores off `teamRatingRaw` now. That was forced by the rescale: compressing the
 * rating scale shrank every marginal gain, so under rounding far more candidates
 * would have scored zero and the AI would have stopped trading — with **no harness
 * band to catch it**, because none asserts deal volume. The health check is the
 * number of clubs that sell in a window, which is 9 of 20 and has been measured by
 * hand at each change.
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
  // Unrounded on purpose — see `teamRatingRaw`. A marginal signing is often worth
  // a fraction of a point, and rounding before subtracting throws that away.
  const rating = teamRatingRaw(startersOf(squad, bestXI(squad, '4-4-2')))
  return rating.attack + rating.defence
}

/**
 * Players an **AI club** would let go: those whose absence costs the XI nothing.
 *
 * The reference shape is 4-4-2 regardless of what the club plays, which is the
 * same fixed-shape approximation `needFor` makes and is fine for a club nobody
 * watches — every AI club is on 4-4-2 anyway, and this is the path every
 * calibrated band in the project is measured through.
 *
 * **It is no longer the manager's rule.** Judging a person by a shape he does not
 * play told him a bench player in his own 4-2-4 was "in your first team", which is
 * simply false — see `saleBlock`.
 */
export function surplus(squad: readonly Player[]): Player[] {
  if (squad.length <= MIN_SQUAD) return []
  const starting = new Set<PlayerId>(bestXI(squad, '4-4-2').starters)

  return squad
    .filter((player) => !starting.has(player.id))
    .filter((player) => canSpare(squad, player))
    .sort((a, b) => overall(a) - overall(b))
}

/**
 * How many goalkeepers a manager must be left holding after a sale.
 *
 * The one floor that survived when selling stopped being judged by `surplus`. A
 * keeper carries `KEEPER_WEIGHT` — 35% — of the defensive rating on his own, more
 * than any other single player, and M6's injuries would leave a one-keeper squad
 * unable to field a legal XI at all. Everything else a squad might run short of
 * degrades gracefully: the lineup screen simply stops offering a shape it cannot
 * fill.
 *
 * Deliberately not `DEEPEST_BANK.GK`, which is 1 and answers a different question
 * — what a formation asks for on the day, not what a season needs in reserve.
 */
export const COVER_KEEPERS = 2

/** Why the manager cannot sell this player. */
export type SaleBlock = 'lineup' | 'coverKeeper'

/**
 * Why this player cannot be sold, or `null` when he can be.
 *
 * **The manager's rule, and it is deliberately not `surplus`.** Two clauses, and
 * that is the whole of it:
 *
 * - He is in the XI you picked. Selling is squad management rather than
 *   asset-stripping — you cannot sell a man out of your own team sheet. Read off
 *   the *stored* lineup, which is also what makes the answer independent of the
 *   order a screen happens to hold the squad in; `surplus` ran `bestXI`, whose
 *   stable sort meant sorting the Plantilla table could change who was sellable.
 * - He is a goalkeeper and you would be left with one. See `COVER_KEEPERS`.
 *
 * There is no squad-size floor and no outfield depth floor, and neither is needed
 * for safety: refusing to sell a starter means eleven legal players with exactly
 * one keeper always remain, whatever else goes.
 *
 * **This is the second notion of "spare", and it exists because the first was
 * wrong for a person.** `surplus` judges against 4-4-2 — so a bench player in a
 * manager's own 4-2-4 was refused as "in your first team" while his row read "not
 * selected", a contradiction on one line. Measured before the change: 20 such rows
 * across the league on most shapes, 40 on 4-2-4, plus 14 reserve goalkeepers and 3
 * midfielders blocked by a depth floor and given the same wrong sentence.
 *
 * A missing lineup falls back to the old reference rather than freeing everybody:
 * the safe answer to "I do not know who is picked" is the one that changes least.
 */
export function saleBlock(
  squad: readonly Player[],
  lineup: Lineup | undefined,
  player: Player,
): SaleBlock | null {
  const starting =
    lineup === undefined ? new Set(bestXI(squad, '4-4-2').starters) : new Set(lineup.starters)
  if (starting.has(player.id)) return 'lineup'

  if (player.position === 'GK') {
    const remaining = squad.filter((p) => p.position === 'GK' && p.id !== player.id).length
    if (remaining < COVER_KEEPERS) return 'coverKeeper'
  }

  return null
}

/**
 * Everyone the manager may put up for sale.
 *
 * Derived from `saleBlock` rather than restating it, so the sentence the Plantilla
 * screen shows and the code the reducer throws cannot drift apart from what is
 * actually enforced. Same reason the ficha imports the resolver's weights instead
 * of writing the percentages out as prose.
 */
export function sellable(squad: readonly Player[], lineup: Lineup | undefined): Player[] {
  return squad
    .filter((player) => saleBlock(squad, lineup, player) === null)
    .sort((a, b) => overall(a) - overall(b))
}

/**
 * The manager's listed players who are *currently* sellable.
 *
 * The rule is applied again here rather than trusted from when the button was
 * pressed. A player listed in August may be in the XI by January — an injury to
 * the man ahead of him, a sale elsewhere, or simply a change of mind — and selling
 * him then would break up a team sheet the manager chose on purpose. Listing says
 * "I would let him go", not "sell him whatever happens".
 */
export function listedForSale(state: GameState): Player[] {
  if (state.transferList.length === 0) return []
  const listed = new Set<PlayerId>(state.transferList)
  return sellable(
    state.squads[state.managedClubId] ?? [],
    state.lineups[state.managedClubId],
  ).filter((player) => listed.has(player.id))
}

/**
 * The cover a club must hold at each position, derived rather than written down.
 *
 * The deeper of two floors. `4-4-2 + 1` is the "one cover beyond the XI" intent —
 * a club does not sell down to exactly eleven. `DEEPEST_BANK` is the most any
 * formation asks for, so a club never sells its way out of a shape it might want
 * to play; that half was added when 4-2-4 arrived wanting a fourth forward and
 * broke the claim that `4-4-2 + 1` covered everything.
 *
 * Exported because the rollover's `topUp` needs the same answer, and reading it
 * from here is what stops the two drifting. **`DEEPEST_BANK` alone is not that
 * answer**: it is 1 at goalkeeper, so a squad down to its last keeper reads as
 * fully stocked — which is exactly the squad most in need of one.
 */
export const COVER_AT_POSITION: Readonly<Record<Position, number>> = Object.fromEntries(
  POSITIONS.map((position) => [
    position,
    Math.max(DEEPEST_BANK[position], FORMATIONS['4-4-2'][position] + 1),
  ]),
) as Record<Position, number>

/** True when removing this player still leaves a legal XI in every shape. */
function canSpare(squad: readonly Player[], player: Player): boolean {
  const remaining = squad.filter((p) => p.id !== player.id)
  return POSITIONS.every(
    (position) =>
      remaining.filter((p) => p.position === position).length >= COVER_AT_POSITION[position],
  )
}

/** Why an AI club will not sell this player at any price, or `null` when it will. */
export type SaleRefusal = 'squadFloor' | 'shape'

/**
 * The seller's veto — the only two reasons a bid is refused outright.
 *
 * Everything else has a price. This replaced the old rule, which was `surplus`
 * membership: a player in his club's best XI was unbuyable **at any figure**,
 * while the AI was free to offer for anyone of yours who was not in your team
 * sheet. That asymmetry was the complaint, and it was one gate in `makeBid`.
 *
 * Both clauses are about the seller's squad surviving, never about his wishes:
 *
 * - `squadFloor` — he is already at `MIN_SQUAD`. The same floor `runTransferWindow`
 *   holds AI sellers to.
 * - `shape` — losing him would leave a bank too thin to field some formation.
 *   **`canSpare`, deliberately, and not a bare "can still field eleven".** The
 *   career harness asserts every squad can field a legal XI in *all eight* shapes,
 *   and `canSpare` is the function that keeps that green; a 4-4-2-only test would
 *   let a human buy a club's fourth forward and break the band with nothing else
 *   to point at.
 */
export function aiSaleRefusal(squad: readonly Player[], player: Player): SaleRefusal | null {
  if (squad.length <= MIN_SQUAD) return 'squadFloor'
  if (!canSpare(squad, player)) return 'shape'
  return null
}

/**
 * What losing this player would cost the seller's best XI.
 *
 * `needFor` asked from the other side — literally the same scoring function, run
 * against the squad that would remain. **Zero for every member of `surplus`**, by
 * construction rather than by tuning: a player outside the best XI cannot change
 * it by leaving. Clamped at zero because `bestXI` can pick a different but equal
 * side, which shows up as a rounding-sized negative.
 */
export function loseCost(squad: readonly Player[], player: Player): number {
  const remaining = squad.filter((p) => p.id !== player.id)
  return Math.max(0, needFor(remaining, player))
}

/**
 * How much over the asking price a club wants before it will hear you out.
 *
 * **Exactly 1 for anyone in `surplus`**, which is what makes this inert for every
 * deal the game could already do — the same property M3c's `tempo` has at balanced
 * tactics and M4b's bid subsystem has when nobody bids. Every calibrated band is
 * untouched because no AI path can reach a premium above 1.
 *
 * **Two terms, because there are two different reasons a club says no**, and one
 * of them alone gets a famous case badly wrong:
 *
 * - `loseCost` says **how much their team suffers**. It is the honest marginal
 *   answer and it is what makes a small club's only good goalkeeper expensive.
 * - `IN_XI_PREMIUM` says **they picked him**. This term exists because the first
 *   one does not do the job on its own: measured on the shipped league, Madrid's
 *   90-rated forward scores `loseCost` **0.00** — there is another 90 behind him,
 *   so the XI genuinely does not get worse — which would have priced him at his
 *   bare asking price of €6.4M and let a €5.3M mid-table club buy him. A club does
 *   not sell the man it picked just because it owns his understudy.
 *
 * Both terms are zero outside the XI and off the depth floor, so the two do not
 * need to agree about anything; they are added, not blended.
 */
export function reluctancePremium(squad: readonly Player[], player: Player): number {
  const picked = bestXI(squad, '4-4-2').starters.includes(player.id)
  const premium = 1 + RELUCTANCE_SLOPE * loseCost(squad, player) + (picked ? IN_XI_PREMIUM : 0)
  return Math.min(RELUCTANCE_CAP, premium)
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

  // **Clubs abroad are treated as clubs, deliberately.** They buy on the same
  // `needFor` score, sell on the same `surplus` rule and are held to the same
  // squad floors, which is what keeps flows across the border two-way by
  // construction rather than by a rule saying so. The one thing they do not share
  // is the ledger: `record` in `applyTransfers` looks a club up and returns if it
  // is absent, so a foreign counterparty simply does not appear in ADR 0009's
  // identity — which is correct, because that identity is per domestic club and
  // says nothing about who is on the other side of a deal.
  //
  // Empty in every harness but `market.foreign.harness.test.ts`, so this changes
  // nothing that was already calibrated.
  const abroad = state.foreign.clubs
  const squads = new Map<ClubId, Player[]>()
  const budgets = new Map<ClubId, number>()
  for (const club of state.clubs) {
    squads.set(club.id, [...(state.squads[club.id] ?? [])])
    budgets.set(club.id, club.budget)
  }
  for (const club of abroad) {
    squads.set(club.id, [...(state.foreign.squads[club.id] ?? [])])
    budgets.set(club.id, club.budget)
  }
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
  // **A club abroad offers a few fringe players, not its whole reserve list.**
  // `surplus` is the right rule for a domestic club, which is managing a squad
  // against a wage bill and a board; a foreign club is doing neither, so its
  // spares are not a "for sale" list in the same sense. Offering all of them
  // made abroad the only market worth shopping in: measured over twelve seasons,
  // the domestic league bought **347 players from abroad and sold 14**, which is
  // more than one foreign signing per club per season and left the domestic
  // market crowded out of its own game.
  //
  // `surplus` sorts ascending by `overall`, so the first few are the genuine
  // fringe — which is exactly who a big club abroad would let go.
  for (const club of abroad) {
    if (club.id === options.exclude) continue
    for (const player of surplus(squads.get(club.id) ?? []).slice(0, FOREIGN_LISTINGS)) {
      listed.push({ player, from: club.id })
    }
  }
  // The manager's own contribution is exactly what he put up for sale. An AI club
  // offers a whole squad's worth of spares automatically; he offers a list.
  if (options.exclude !== undefined) {
    for (const player of listedForSale(state)) listed.push({ player, from: options.exclude })
  }
  for (const player of state.freeAgents) listed.push({ player, from: null })

  // Foreign clubs take their turn in the same rotation. The shuffle is longer than
  // it was, which changes the draw count — expected, and inert wherever the layer
  // is empty, which is everywhere the existing bands are measured.
  const order = shuffle([...state.clubs, ...abroad], rng)

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
      .filter((entry) => entry.need / entry.cost > valueFloorFor(budgets.get(club.id) ?? 0))
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
    // competing with a fee for the same money.
    //
    // **The paid rate is no longer a flat one.** It was, from M4a to here, and the
    // whole league did about nine deals a season between twenty clubs — a club
    // bought a player roughly every other year, which is why the shop window never
    // looked any different. A club sitting on more than the pivot may do two.
    let paid = 0
    let free = 0
    const paidAllowance = (budgets.get(club.id) ?? 0) > WEALTH_PIVOT ? MAX_PAID_SIGNINGS : 1

    for (const candidate of candidates) {
      if (paid >= paidAllowance && free >= MAX_FREE_SIGNINGS) break
      if (candidate.from === null ? free >= MAX_FREE_SIGNINGS : paid >= paidAllowance) continue

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
        if (!sellerSquad.some((p) => p.id === candidate.player.id)) continue // already sold
        // Re-checked against the squad *as it stands now*, not as it stood when
        // `listed` was built. Two of a club's forwards can each be spareable on
        // their own and leave it with two between them — which is a squad that
        // cannot field a 4-3-3, and the career harness says that must never happen.
        //
        // **The manager is judged by his own rule here, and he has to be.** This is
        // the last gate a sale passes through, so leaving him on `canSpare` would
        // have silently vetoed deals the Plantilla screen and the reducer had both
        // already allowed — a listed bench forward at a four-forward club would
        // simply never move, with nothing said anywhere.
        if (candidate.from === options.exclude) {
          if (saleBlock(sellerSquad, state.lineups[candidate.from], candidate.player) !== null) {
            continue
          }
        } else {
          if (sellerSquad.length <= MIN_SQUAD) continue
          if (!canSpare(sellerSquad, candidate.player)) continue
        }

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

      // Capping each kind keeps a rich club from emptying the market in a single
      // pass, and spreads business across the league.
      if (candidate.from === null) free += 1
      else paid += 1

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

  // Domestic and foreign squads are held in one map here so a deal reads the same
  // whichever side of the border each club is on; they are split apart again at
  // the end. **The ledgers map is domestic only, deliberately** — `record` looks a
  // club up and returns when it is absent, so a foreign counterparty never
  // appears in ADR 0009's identity. That is right rather than an omission: the
  // identity is per domestic club and says nothing about who is opposite.
  const squads: Record<string, Player[]> = {}
  for (const club of state.clubs) squads[club.id] = [...(state.squads[club.id] ?? [])]
  for (const club of state.foreign.clubs) {
    squads[club.id] = [...(state.foreign.squads[club.id] ?? [])]
  }
  const budgets = new Map<ClubId, number>([
    ...state.clubs.map((c) => [c.id, c.budget] as [ClubId, number]),
    ...state.foreign.clubs.map((c) => [c.id, c.budget] as [ClubId, number]),
  ])
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
  const foreignIds = new Set<ClubId>(state.foreign.clubs.map((club) => club.id))
  for (const clubId of touched) {
    // A foreign club has no lineup and never needs one — nothing resolves a match
    // for it. Giving it one here would be the first step toward the second
    // competition ground rule 5 is still holding back.
    if (foreignIds.has(clubId)) continue
    const squad = squads[clubId] ?? []
    if (squad.length < 11) continue
    // Selling can take a squad below the bank its shape needs — a club on 4-2-4
    // that sells a fourth forward. `bestXI` throws on that, inside `dispatch`,
    // with nothing to catch it.
    const formation = fieldableFormation(squad, state.lineups[clubId]?.formation ?? '4-4-2')

    if (clubId === state.managedClubId && keepsLineup(squad, state.lineups[clubId])) continue
    lineups[clubId] = bestXI(squad, formation)
  }

  // A sold player comes off the transfer list, or it slowly fills with the ids of
  // players who left years ago.
  const own = new Set<PlayerId>((squads[state.managedClubId] ?? []).map((p) => p.id))
  const transferList = state.transferList.filter((id) => own.has(id))

  // Split the one working map back into the two the state keeps.
  const domestic: Record<string, Player[]> = {}
  const abroad: Record<string, Player[]> = {}
  for (const [clubId, squad] of Object.entries(squads)) {
    if (foreignIds.has(clubId as ClubId)) abroad[clubId] = squad
    else domestic[clubId] = squad
  }

  return {
    ...state,
    clubs,
    squads: domestic,
    foreign: {
      clubs: state.foreign.clubs.map((club) => ({
        ...club,
        budget: budgets.get(club.id) ?? club.budget,
      })),
      squads: abroad,
    },
    lineups,
    freeAgents,
    transferList,
  }
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
