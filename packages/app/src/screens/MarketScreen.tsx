import { type Ref, useEffect, useMemo, useRef, useState } from 'react'
import {
  ageOn,
  askingPrice,
  type Bid,
  canAfford,
  isGameError,
  bidIsLive,
  type ClubId,
  createRng,
  type DayNumber,
  debtLimit,
  type Event,
  FINANCE,
  type GameState,
  isTransferWindowOpen,
  listedForSale,
  MAX_CONTRACT_YEARS,
  MIN_CONTRACT_YEARS,
  overall,
  type Player,
  type PlayerId,
  type Position,
  POSITIONS,
  ROUNDS_PER_HALF,
  shuffle,
  signingOutlay,
  suggestedTerms,
  surplus,
  toCivil,
} from '@fm/domain'
import { useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import { PlayerLink } from './PlayerLink.tsx'
import { describe as describeEvent, lookupFor } from '../notifications.ts'
import { type Translator, useT } from '../i18n/useT.ts'
import { type Sort, sortedBy } from '../sorting.ts'
import { SortHeader } from './SortHeader.tsx'
import { positionChip } from './SquadScreen.tsx'
import './MarketScreen.css'

/**
 * The transfer market.
 *
 * Two things are on offer and they behave differently, so the table says which:
 * players other clubs have **listed** cost a fee and have to be bid for, while a
 * **free agent** costs nothing but wages and can be signed on the spot. That
 * second column is the whole reason a club with no money still has something to
 * do here.
 *
 * The screen never decides anything. Every button dispatches a command and the
 * reducer accepts or refuses it — a screen can forget a rule, and this one is
 * deliberately allowed to.
 */

export interface Listing {
  readonly player: Player
  /** `null` for a free agent — nobody to pay. */
  readonly from: ClubId | null
  readonly fee: number
}

/**
 * Which transfer window a date belongs to.
 *
 * Windows are July/August and January, but the clock spends most of the season
 * outside one and the market list still has to hold still. So every date maps to
 * the window it most recently belonged to: February to June follow January, and
 * July to December follow the summer.
 */
export function windowKey(date: DayNumber): number {
  const { y, m } = toCivil(date)
  return m <= 6 ? y * 2 + 1 : y * 2
}

/**
 * The order players appear in — deliberately shuffled, not ranked.
 *
 * The screen used to sort by how much a player would improve your XI, which
 * turned scouting into reading the top row. Nothing is ranked for you now; the
 * columns are all sortable if you want an angle on it.
 *
 * Seeded from the window and your club, so the order holds still across
 * re-renders, navigation and a save/reload — a list that reshuffled on every
 * render would be unusable — while January still looks like a different market
 * from August. Deterministic, so no ordering has to be stored in the save.
 */
export function marketSeed(date: DayNumber, managedClubId: ClubId): number {
  let hash = windowKey(date)
  for (let i = 0; i < managedClubId.length; i++) {
    hash = (hash * 31 + managedClubId.charCodeAt(i)) | 0
  }
  return hash
}

/**
 * Everything you could sign today, in market order.
 *
 * Exported so it can be tested without rendering — the same pattern `bandFor`
 * follows on the table screen.
 */
export function listingsFor(game: GameState): Listing[] {
  const managed = game.managedClubId
  const date = game.season.currentDate
  const listings: Listing[] = []

  for (const clubId of game.competition.clubIds) {
    if (clubId === managed) continue
    for (const player of surplus(game.squads[clubId] ?? [])) {
      listings.push({ player, from: clubId, fee: askingPrice(player, date) })
    }
  }
  for (const player of game.freeAgents) {
    listings.push({ player, from: null, fee: 0 })
  }

  return shuffle(listings, createRng(marketSeed(date, managed)))
}

export type SortKey = 'overall' | 'fee' | 'age' | 'name' | 'club'

/** Text columns read left, numbers read right — the `data-table` convention. */
const SORT_ALIGN: Readonly<Record<SortKey, string>> = {
  name: 'is-text',
  club: 'is-text',
  age: '',
  overall: '',
  fee: '',
}

/**
 * What a column sorts on.
 *
 * Unsorted means market order — the shuffle. These exist because a list of two
 * hundred is only navigable if you can take an angle on it — sorting by `Asking` is
 * how a club with no money finds what it can afford — but none of them tells you
 * whether a player would actually get into your team.
 *
 * `club` sorts on the seller's **name**, not his id. It used to sort on the id, which
 * is an ASCII slug — `a-coruna` for `A Coruña`, `malaga` for `Málaga`. On today's
 * twenty clubs the two orderings happen to coincide exactly, so nothing was visibly
 * wrong; it sorted a column by a key the column does not show and got away with it.
 * The name is what the reader is comparing, and it is what the locale collation
 * threaded through this screen was obtained for.
 *
 * A free agent has no seller and sorts as the empty string, which keeps the free
 * agents together instead of scattering them through whatever `market.freeAgent`
 * happens to translate to.
 */
export function listingValue(
  listing: Listing,
  key: SortKey,
  date: DayNumber,
  nameOf: (id: ClubId) => string,
): number | string {
  switch (key) {
    case 'overall':
      return overall(listing.player)
    case 'fee':
      return listing.fee
    case 'age':
      return ageOn(listing.player, date)
    case 'name':
      return listing.player.name
    case 'club':
      return listing.from === null ? '' : nameOf(listing.from)
  }
}

export function MarketScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const go = useGame((s) => s.go)
  const translator = useT()
  const { t, money, locale } = translator

  const [target, setTarget] = useState<PlayerId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyShortlist, setOnlyShortlist] = useState(false)
  const [onlyAffordable, setOnlyAffordable] = useState(false)
  const [onlyFree, setOnlyFree] = useState(false)
  /** Empty means every position, so the default is unfiltered. */
  const [positions, setPositions] = useState<readonly Position[]>([])
  /** `null` is market order — the shuffle. A column cycles back to it. */
  const [sort, setSort] = useState<Sort<SortKey> | null>(null)

  const dealRef = useRef<HTMLElement>(null)

  /**
   * Bring the deal into view when one is opened.
   *
   * The rail is its own scroll container and the negotiation panel sits near the
   * top of it, while `Your bids` — the only way to pick an agreed fee back up —
   * is at the bottom. Pressing Open inserted the panel above the viewport and
   * left the scroll offset alone, so the deal you had just asked for was
   * off-screen and the button read as dead. That is what made a fee you had
   * already agreed impossible to settle.
   *
   * Keyed on the target rather than the panel: reopening the same player should
   * not fight a manager who has scrolled away deliberately.
   */
  useEffect(() => {
    if (target === null) return
    // jsdom has no layout and does not implement this at all.
    dealRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [target])

  const managed = game.managedClubId
  const club = game.clubs.find((c) => c.id === managed)
  const date = game.season.currentDate
  const open = isTransferWindowOpen(date)
  const names = new Map(game.clubs.map((c) => [c.id, c]))
  const shortlisted = new Set(game.shortlist)
  const clubCount = game.competition.clubIds.length
  const spendable =
    club === undefined ? 0 : club.budget + debtLimit(club, clubCount, ROUNDS_PER_HALF)

  /**
   * The same question the reducer asks before it accepts a bid — fee plus the
   * signing bonus, against the balance *and* the overdraft.
   */
  const affordable = (fee: number) =>
    club === undefined || canAfford(club, signingOutlay(fee), clubCount, ROUNDS_PER_HALF)

  // One memo is enough now. This used to be split in two because it scored every
  // listing with `needFor` — two `bestXI` passes apiece, a couple of hundred times
  // — and that half depended on squads while the prices depended on the date.
  // Taking the "Improves" column off the screen took the scoring with it.
  const all = useMemo(() => listingsFor(game), [game])

  // Filtering and sorting stay outside the memo: they are cheap, and they change
  // with the controls rather than with the game.
  const filtered = all
    .filter((l) => !onlyShortlist || shortlisted.has(l.player.id))
    .filter((l) => !onlyFree || l.from === null)
    // The reducer's own rule, not a fee-against-balance guess. It was both:
    // blind to the signing bonus, so the filter offered deals `MakeBid` then
    // refused; and blind to the overdraft, so it hid every player the club could
    // legally borrow for. A free agent still passes — no fee, so no bonus either.
    .filter((l) => !onlyAffordable || affordable(l.fee))
    .filter((l) => positions.length === 0 || positions.includes(l.player.position))

  const listings = sortedBy(
    filtered,
    sort,
    (listing, key) => listingValue(listing, key, date, (id) => names.get(id)?.name ?? ''),
    locale,
  )

  function toggle<T>(list: readonly T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  /** The shared header, bound to this screen's sort state. */
  function column(key: SortKey, label: string) {
    return (
      <SortHeader column={key} label={label} sort={sort} onSort={setSort} align={SORT_ALIGN[key]} />
    )
  }

  // What is actually on the market, not merely what you clicked: a player listed
  // in August may have won his place back by January, and `listedForSale` is what
  // the transfer window will really act on.
  const onSale = listedForSale(game)
  const outgoing = game.bids.filter((b) => b.from === managed && bidIsLive(b))
  const incoming = game.bids.filter((b) => b.to === managed && b.status === 'pending')
  const byId = new Map<PlayerId, Player>(
    [...game.clubs.flatMap((c) => game.squads[c.id] ?? []), ...game.freeAgents].map((p) => [
      p.id,
      p,
    ]),
  )

  /**
   * Run a command and say what came of it.
   *
   * Two different things can go wrong and only one of them throws. A command the
   * reducer *refuses* throws a `GameError` — a rule you broke, and that message
   * is the useful one. A command it *accepts* can still not get you what you
   * wanted: terms a player turns down come back as a `TermsRejected` event with
   * the state untouched, and nothing is thrown at all.
   *
   * Before the shell's news drawer went, that second case at least lit a badge.
   * Now the only feed is on the hub — a different screen from the one you
   * pressed the button on — so without this the button reads as broken.
   */
  function attempt(action: () => readonly Event[] | void) {
    try {
      const events = action() ?? []
      const outcome = events.find((event) => event.type === 'TermsRejected')
      // Reuse the feed's own sentence rather than writing a second one for the
      // same event; `describe` already resolves his name and what he wants.
      setError(
        outcome === undefined
          ? null
          : (describeEvent(outcome, game, lookupFor(game, translator), translator)?.text ?? null),
      )
    } catch (thrown) {
      // A refusal carries a code; the sentence it also carries is the fallback
      // for anything that has not been given one.
      setError(
        isGameError(thrown)
          ? t(thrown.code, thrown.params)
          : thrown instanceof Error
            ? thrown.message
            : t('error.unknown'),
      )
    }
  }

  /**
   * The deal on the table, if any.
   *
   * The listing is the usual source, but a bid outlives it: `listingsFor` is
   * rebuilt from each club's *live* `surplus`, so a player you have already bid
   * for can stop being spare — sign someone else from that club and their squad
   * changes underneath you. The bid still carries everything the panel needs, so
   * it is the fallback rather than a dead end. Opening a bid must never be a
   * press that does nothing.
   */
  const selected = ((): Listing | null => {
    if (target === null) return null

    const listed = all.find((l) => l.player.id === target)
    if (listed !== undefined) return listed

    const bid = outgoing.find((b) => b.playerId === target)
    const player = byId.get(target)
    if (bid === undefined || player === undefined) return null

    return { player, from: bid.to, fee: bid.counterFee ?? bid.fee }
  })()

  return (
    <div className="market-screen">
      <section className="screen market-screen__main">
        <h2 className="screen__heading">{t('market.heading')}</h2>

        {!open && <p className="screen__note">{t('market.windowShut')}</p>}

        {/* Every control is a toggle labelled with the mode it turns on, with
            `aria-pressed` carrying whether it is active. Labelling one with its
            *current* state instead made the button you press to filter read
            "Whole market", which is backwards. */}
        <div className="market-screen__filters">
          <span className="market-screen__positions">
            {POSITIONS.map((position) => (
              <button
                key={position}
                type="button"
                className={`button market-screen__mini${positions.includes(position) ? ' is-primary' : ''}`}
                aria-pressed={positions.includes(position)}
                onClick={() => setPositions(toggle(positions, position))}
              >
                {position}
              </button>
            ))}
          </span>
          <button
            type="button"
            className={`button market-screen__mini${onlyAffordable ? ' is-primary' : ''}`}
            aria-pressed={onlyAffordable}
            onClick={() => setOnlyAffordable(!onlyAffordable)}
          >
            {t('market.withinBudget')}
          </button>
          <button
            type="button"
            className={`button market-screen__mini${onlyFree ? ' is-primary' : ''}`}
            aria-pressed={onlyFree}
            onClick={() => setOnlyFree(!onlyFree)}
          >
            {t('market.freeAgents')}
          </button>
          <button
            type="button"
            className={`button market-screen__mini${onlyShortlist ? ' is-primary' : ''}`}
            aria-pressed={onlyShortlist}
            onClick={() => setOnlyShortlist(!onlyShortlist)}
          >
            {t('market.shortlistOnly')}
          </button>
          <span className="market-screen__count">
            {t('market.showing', { shown: listings.length, total: all.length })}
          </span>
        </div>

        {listings.length === 0 ? (
          <p className="screen__note">{t('market.noMatches')}</p>
        ) : (
          <table className="data-table">
            <thead className="data-table__head">
              <tr>
                <th className="is-text">{t('market.column.position')}</th>
                {column('name', t('market.column.player'))}
                {column('club', t('market.column.club'))}
                {column('age', t('market.column.age'))}
                {column('overall', t('market.column.overall'))}
                {column('fee', t('market.column.asking'))}
                <th className="is-text">{t('market.column.action')}</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => {
                const { player } = listing
                const isTarget = player.id === target
                return (
                  <tr
                    key={player.id}
                    className={`data-table__row is-clickable${isTarget ? ' is-you' : ''}`}
                  >
                    <td className="is-text">
                      {positionChip(player.position, t(`position.${player.position}`))}
                    </td>
                    <td className="is-text">
                      <PlayerLink player={player} />
                    </td>
                    <td className="is-text">
                      {listing.from === null ? (
                        <span className="market-screen__free">{t('market.freeAgent')}</span>
                      ) : (
                        (() => {
                          // The badge carries the three-letter code already —
                          // repeating it beside itself just read as "GRAGRA".
                          const seller = names.get(listing.from)
                          return seller === undefined ? '???' : <ClubBadge club={seller} labelled />
                        })()
                      )}
                    </td>
                    <td>{ageOn(player, date)}</td>
                    <td>
                      <strong>{overall(player)}</strong>
                    </td>
                    <td>{listing.fee === 0 ? t('market.free') : money(listing.fee)}</td>
                    <td className="is-text market-screen__actions">
                      <button
                        type="button"
                        className="button market-screen__mini"
                        aria-pressed={shortlisted.has(player.id)}
                        onClick={() =>
                          dispatch({
                            type: 'Shortlist',
                            playerId: player.id,
                            on: !shortlisted.has(player.id),
                          })
                        }
                      >
                        {shortlisted.has(player.id) ? t('market.watching') : t('market.watch')}
                      </button>
                      <button
                        type="button"
                        className="button is-primary market-screen__mini"
                        disabled={!open}
                        onClick={() => {
                          setTarget(player.id)
                          setError(null)
                        }}
                      >
                        {listing.from === null ? t('market.sign') : t('market.bid')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <aside className="market-screen__side">
        <section className="screen market-screen__panel">
          <div className="market-screen__money">
            <div className="stat">
              <span className="stat__label">{t('market.budget')}</span>
              <span className="stat__value">{money(club?.budget ?? 0)}</span>
            </div>
            {/* The balance alone contradicts the filter beside it, which spends to
                the overdraft because the reducer does. This is the figure "Within
                budget" is actually testing against. */}
            <div className="stat">
              <span className="stat__label">{t('caja.available')}</span>
              <span className="stat__value">{money(spendable)}</span>
            </div>
            <div className="stat">
              <span className="stat__label">{t('market.window')}</span>
              <span className="stat__value market-screen__window">
                {open ? t('market.windowOpen') : t('market.windowClosed')}
              </span>
            </div>
          </div>
        </section>

        {error !== null && (
          <section className="screen market-screen__panel">
            <p className="screen__note market-screen__error" role="alert">
              {error}
            </p>
          </section>
        )}

        {selected !== null && (
          <NegotiationPanel
            // Remounts per player. The fee, wage and years are `useState`
            // initialisers, which run once — without a key, switching from one
            // bid to another reuses the instance and leaves the previous
            // player's numbers in the fields, and offering *his* wage to
            // somebody who wants more is refused with the state untouched.
            key={selected.player.id}
            ref={dealRef}
            listing={selected}
            bid={outgoing.find((b) => b.playerId === selected.player.id)}
            date={date}
            open={open}
            onAttempt={attempt}
            onClose={() => setTarget(null)}
          />
        )}

        <section className="screen market-screen__panel">
          <h2 className="screen__heading">{t('market.upForSale')}</h2>
          {onSale.length === 0 ? (
            <p className="screen__note">{t('market.nobodyListed')}</p>
          ) : (
            <ul className="offer-list">
              {onSale.map((player) => (
                <li key={player.id} className="offer-list__item">
                  <span className="offer-list__name">
                    <PlayerLink player={player} />
                  </span>
                  <span className="offer-list__detail">
                    {t('market.askingLine', {
                      position: t(`position.${player.position}`),
                      fee: money(askingPrice(player, date)),
                    })}
                  </span>
                  <span className="offer-list__actions">
                    <button
                      type="button"
                      className="button market-screen__mini"
                      onClick={() =>
                        attempt(() =>
                          dispatch({ type: 'ListPlayer', playerId: player.id, on: false }),
                        )
                      }
                    >
                      {t('market.takeOff')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="screen market-screen__panel market-screen__inbox">
          <h2 className="screen__heading">{t('market.offersForYours')}</h2>
          {incoming.length === 0 ? (
            <p className="screen__note">{t('market.noOffers')}</p>
          ) : (
            <ul className="offer-list">
              {incoming.map((bid) => (
                <li key={bid.id} className="offer-list__item">
                  <BidName player={byId.get(bid.playerId)} t={t} />
                  <span className="offer-list__detail club-cell">
                    {(() => {
                      const bidder = names.get(bid.from)
                      return bidder === undefined ? '???' : <ClubBadge club={bidder} labelled />
                    })()}
                    {money(bid.fee)}
                  </span>
                  <span className="offer-list__actions">
                    <button
                      type="button"
                      className="button is-primary market-screen__mini"
                      onClick={() =>
                        attempt(() =>
                          dispatch({ type: 'RespondToOffer', bidId: bid.id, accept: true }),
                        )
                      }
                    >
                      {t('market.accept')}
                    </button>
                    <button
                      type="button"
                      className="button market-screen__mini"
                      onClick={() =>
                        attempt(() =>
                          dispatch({ type: 'RespondToOffer', bidId: bid.id, accept: false }),
                        )
                      }
                    >
                      {t('market.reject')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="screen market-screen__panel market-screen__outbox">
          <h2 className="screen__heading">{t('market.yourBids')}</h2>
          {outgoing.length === 0 ? (
            <p className="screen__note">{t('market.noBids')}</p>
          ) : (
            <ul className="offer-list">
              {outgoing.map((bid) => (
                <li
                  key={bid.id}
                  // Marks which deal the negotiation panel is showing. The panel
                  // is at the top of a rail this list sits at the bottom of, so
                  // the press needs an answer here as well as up there.
                  className={`offer-list__item${bid.playerId === target ? ' is-active' : ''}`}
                >
                  <BidName player={byId.get(bid.playerId)} t={t} />
                  <span className="offer-list__detail">
                    {money(bid.fee)} · {describeBid(bid, translator)}
                  </span>
                  <span className="offer-list__actions">
                    <button
                      type="button"
                      className="button market-screen__mini"
                      onClick={() => {
                        setTarget(bid.playerId)
                        setError(null)
                      }}
                    >
                      {t('market.openNegotiation')}
                    </button>
                    <button
                      type="button"
                      className="button market-screen__mini"
                      onClick={() =>
                        attempt(() => dispatch({ type: 'WithdrawBid', bidId: bid.id }))
                      }
                    >
                      {t('market.withdraw')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="screen-actions">
          <button type="button" className="button" onClick={() => go('hub')}>
            {t('action.back')}
          </button>
        </div>
      </aside>
    </div>
  )
}

/**
 * The name at the head of a bid row, on either side of the deal.
 *
 * The lookup can miss: a bid outlives the squad it was made against, so the man
 * may have retired or moved on since. The fallback stays plain text because
 * there is no card behind it — a link that opens the empty ficha would be worse
 * than no link at all.
 */
function BidName({ player, t }: { player: Player | undefined; t: Translator['t'] }) {
  return (
    <span className="offer-list__name">
      {/* Nested rather than given the class, because `.offer-list__name` sets
          type. `.player-link` carries `font: inherit`, so the two would be a
          same-specificity fight settled by import order — inheriting the bold
          from a wrapper is the same split `.lineup-row__select` makes. */}
      {player === undefined ? t('market.unknownPlayer') : <PlayerLink player={player} />}
    </span>
  )
}

/** Module-level, so the translator arrives as an argument rather than a hook. */
function describeBid(bid: Bid, { t, money }: Translator): string {
  if (bid.status === 'accepted') return t('market.feeAgreed')
  if (bid.status === 'countered')
    return t('market.theyWant', { fee: money(bid.counterFee ?? bid.fee) })
  return t('market.awaiting')
}

interface NegotiationProps {
  readonly listing: Listing
  readonly bid: Bid | undefined
  readonly date: DayNumber
  readonly open: boolean
  /** So the screen can scroll the deal into view when it opens. */
  readonly ref?: Ref<HTMLElement>
  onAttempt(action: () => readonly Event[] | void): void
  onClose(): void
}

/**
 * One player, and whichever half of the deal is outstanding.
 *
 * A free agent skips straight to terms — there is no fee and nobody to negotiate
 * it with. Everyone else needs a fee agreed first, which is why the two steps are
 * visibly separate rather than one "buy" button.
 */
function NegotiationPanel({ listing, bid, date, open, ref, onAttempt, onClose }: NegotiationProps) {
  const dispatch = useGame((s) => s.dispatch)
  const { t, money, percent } = useT()
  const { player } = listing
  const wanted = suggestedTerms(player, date)

  const [fee, setFee] = useState(String(bid?.counterFee ?? listing.fee))
  const [wage, setWage] = useState(String(wanted.wage))
  const [years, setYears] = useState(String(wanted.years))

  const feeAgreed = listing.from === null || bid?.status === 'accepted'

  return (
    <section className="screen market-screen__panel" ref={ref}>
      {/* The name is the heading *and* a way into his ficha — this panel asks
          you to commit money to a man whose card was two screens away. A button
          inside a heading still computes into the heading's accessible name, so
          `getByRole('heading', { name })` is unaffected. */}
      <h2 className="screen__heading">
        <PlayerLink player={player} />
      </h2>

      <div className="market-screen__deal">
        {!feeAgreed && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="fee">
                {t('market.feeField', { fee: money(bid?.counterFee ?? listing.fee) })}
              </label>
              <input
                id="fee"
                className="number-input"
                type="number"
                min={1}
                step={50}
                value={fee}
                onChange={(event) => setFee(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="button is-primary"
              disabled={!open}
              onClick={() =>
                onAttempt(() => {
                  if (bid !== undefined) dispatch({ type: 'WithdrawBid', bidId: bid.id })
                  dispatch({ type: 'MakeBid', playerId: player.id, fee: Number(fee) })
                })
              }
            >
              {t(bid === undefined ? 'market.makeBid' : 'market.bidAgain')}
            </button>
            {/* The bonus was charged silently — `affordable` has always counted it,
                so the only way to find out it existed was to be refused, or to read
                it off the accounts a week later as a line you did not authorise. */}
            <p className="screen__note market-screen__hint">
              {t('market.outlay', {
                bonus: money(signingOutlay(Number(fee) || 0) - (Number(fee) || 0)),
                total: money(signingOutlay(Number(fee) || 0)),
                percent: percent(FINANCE.SIGNING_BONUS),
              })}
            </p>
            <p className="screen__note market-screen__hint">{t('market.bidHint')}</p>
          </>
        )}

        {feeAgreed && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="wage">
                {t('market.wageField', { wage: money(wanted.wage) })}
              </label>
              <input
                id="wage"
                className="number-input"
                type="number"
                min={0}
                step={50}
                value={wage}
                onChange={(event) => setWage(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="years">
                {t('market.yearsField')}
              </label>
              <input
                id="years"
                className="number-input"
                type="number"
                min={MIN_CONTRACT_YEARS}
                max={MAX_CONTRACT_YEARS}
                step={1}
                value={years}
                onChange={(event) => setYears(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="button is-primary"
              disabled={!open}
              onClick={() =>
                onAttempt(() =>
                  dispatch({
                    type: 'OfferContract',
                    playerId: player.id,
                    wage: Number(wage),
                    years: Number(years),
                  }),
                )
              }
            >
              {t(listing.from === null ? 'market.signHim' : 'market.offerTerms')}
            </button>
            <p className="screen__note market-screen__hint">{t('market.termsHint')}</p>
          </>
        )}

        <button type="button" className="button" onClick={onClose}>
          {t('action.close')}
        </button>
      </div>
    </section>
  )
}
