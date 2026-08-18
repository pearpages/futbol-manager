import { type Ref, useEffect, useMemo, useRef, useState } from 'react'
import {
  ageOn,
  askingPrice,
  type Bid,
  canAfford,
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
  COUNTRIES,
  FOREIGN_LISTINGS,
  POSITIONS,
  reluctancePremium,
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
import { useAttempt } from '../attempt.ts'
import { type Translator, useT } from '../i18n/useT.ts'
import { type Sort, sortedBy } from '../sorting.ts'
import { SortHeader } from './SortHeader.tsx'
import { POSITION_ORDER, positionChip } from './SquadScreen.tsx'
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
  // Abroad offers the same few fringe players the AI window sees, and for the same
  // reason — see `FOREIGN_LISTINGS`. A club abroad is not running a clearance sale
  // for a foreign league, and showing its whole reserve list here would drown the
  // domestic market in players nobody is really selling. **Everyone else abroad is
  // still reachable**, through the Clubs tab and the bid dialog on his card.
  for (const club of game.foreign.clubs) {
    for (const player of surplus(game.foreign.squads[club.id] ?? []).slice(0, FOREIGN_LISTINGS)) {
      listings.push({ player, from: club.id, fee: askingPrice(player, date) })
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

/**
 * What the club browser sorts on.
 *
 * `wants` is the figure that matters and the only one here that is not a plain
 * property of the player: what his club would actually take, which is his asking
 * price times how badly they would rather keep him. A spare player's is exactly
 * his asking price, so the two columns agree wherever they can be compared.
 *
 * **Position sorts on `POSITION_ORDER`, never the chip** — `POR/DEF/MIG/DAV` and
 * `GK/DF/MF/FW` order the same squad differently.
 */
export type SquadSortKey = 'position' | 'name' | 'age' | 'overall' | 'wants'

const SQUAD_SORT_ALIGN: Readonly<Record<SquadSortKey, string>> = {
  position: 'is-text',
  name: 'is-text',
  age: '',
  overall: '',
  wants: '',
}

/** What a rival club would take for him: his price, times its reluctance. */
export function scoutedPrice(squad: readonly Player[], player: Player, date: DayNumber): number {
  return Math.round(askingPrice(player, date) * reluctancePremium(squad, player))
}

export function squadValue(
  player: Player,
  key: SquadSortKey,
  squad: readonly Player[],
  date: DayNumber,
): number | string {
  switch (key) {
    case 'position':
      return POSITION_ORDER[player.position]
    case 'name':
      return player.name
    case 'age':
      return ageOn(player, date)
    case 'overall':
      return overall(player)
    case 'wants':
      return scoutedPrice(squad, player, date)
  }
}

export function MarketScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const translator = useT()
  const { t, money, locale } = translator

  const [target, setTarget] = useState<PlayerId | null>(null)
  const { error, attempt, clear: clearError } = useAttempt(game, translator)
  const [onlyShortlist, setOnlyShortlist] = useState(false)
  const [onlyAffordable, setOnlyAffordable] = useState(false)
  const [onlyFree, setOnlyFree] = useState(false)
  /** Empty means every position, so the default is unfiltered. */
  const [positions, setPositions] = useState<readonly Position[]>([])
  /** `null` is market order — the shuffle. A column cycles back to it. */
  const [sort, setSort] = useState<Sort<SortKey> | null>(null)

  /**
   * Which half of the screen you are on.
   *
   * **En venda is what a club will sell; Clubs is everyone else.** The two are
   * genuinely different questions and folding them into one table was never an
   * option: `listingsFor` is each club's `surplus`, and putting ~500 rival players
   * into it would stop the list meaning "for sale" at all — the 60-row-cap defect
   * in reverse. The browser exists because the reducer now takes a bid for anyone,
   * and a rule you cannot reach anybody through is not a feature.
   */
  const tab = useGame((s) => s.marketTab)
  const setTab = useGame((s) => s.setMarketTab)
  const browsing = useGame((s) => s.browsingClubId)
  const setBrowsing = useGame((s) => s.browseClub)
  /** `null` is squad order — position, then quality, as Plantilla lays it out. */
  const [squadSort, setSquadSort] = useState<Sort<SquadSortKey> | null>(null)

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
  // Foreign sellers too, or their listings show a blank club column.
  const names = new Map<ClubId, { name: string; shortName: string; id: ClubId }>(
    [...game.clubs, ...game.foreign.clubs].map((c) => [
      c.id,
      { id: c.id, name: c.name, shortName: c.shortName },
    ]),
  )
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

  // Clubs you can scout — everyone but yours. A club with no squad cannot be
  // browsed, which is what makes the fallback `?? []` below the whole guard.
  // Everyone you can scout: the division, then abroad. Foreign clubs are narrowed
  // to what the picker and the badge read, so one list serves both kinds.
  const rivals: readonly Browsable[] = [
    ...game.clubs
      .filter((c) => c.id !== managed)
      .map((c) => ({ id: c.id, name: c.name, shortName: c.shortName })),
    ...game.foreign.clubs.map((c) => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      country: c.country,
    })),
  ]
  const browsed = rivals.find((c) => c.id === browsing) ?? rivals[0]
  const browsedSquad =
    browsed === undefined ? [] : (game.squads[browsed.id] ?? game.foreign.squads[browsed.id] ?? [])

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

        {/* Two buttons with `aria-pressed`, not a `role="tablist"` — the same call
            `ResultsScreen` records, and for the same reason: a tablist owes
            arrow-key navigation to be honest about the role. */}
        <div className="market-screen__tabs">
          {(['forSale', 'clubs'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`button${tab === key ? ' is-primary' : ''}`}
              aria-pressed={tab === key}
              onClick={() => {
                setTab(key)
              }}
            >
              {t(`market.tab.${key}`)}
            </button>
          ))}
        </div>

        {!open && <p className="screen__note">{t('market.windowShut')}</p>}

        {tab === 'clubs' ? (
          <ClubBrowser
            clubs={rivals}
            club={browsed}
            squad={browsedSquad}
            date={date}
            sort={squadSort}
            onSort={setSquadSort}
            onPick={setBrowsing}
            translator={translator}
          />
        ) : (
          <>
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
                              return seller === undefined ? (
                                '???'
                              ) : (
                                <ClubBadge club={seller} labelled />
                              )
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
                              clearError()
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
          </>
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
                        clearError()
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
/**
 * A rival club's whole squad, read-only.
 *
 * **What makes symmetric bidding usable.** The reducer takes a bid for anyone now,
 * but the only players the screen could show were each club's `surplus` — the ones
 * it had already given up on — so the rule had nobody to point it at. Here you can
 * go looking.
 *
 * `Demanen` is the figure a manager actually needs: not what the player is worth
 * but what his club would take, which is his asking price times how reluctant they
 * are to lose him. For a spare player the two are the same number.
 *
 * **Five columns, and wage and contract are not among them.** Not secrecy — the
 * ficha shows both for anybody, and it should, because you cannot judge personal
 * terms without knowing what a man already earns. This is a *scanning* view over
 * nineteen squads and the card is the detail view, which is how every other table
 * in the app is split. What does stay off both is `needFor`: it came off the market
 * at M4c because it turns scouting into a lookup, and nothing here puts it back.
 *
 * The name is a `PlayerLink`, which is the route to a bid — his card carries the
 * button. One click rather than a second bid control here, and it keeps the ficha
 * as the single door for anyone who is not already for sale.
 */
/** Only what the browser reads, so a club abroad fits beside a domestic one. */
interface Browsable {
  readonly id: ClubId
  readonly name: string
  readonly shortName: string
  /** Absent for a club at home — which is how the picker groups them. */
  readonly country?: string
}

interface ClubBrowserProps {
  readonly clubs: readonly Browsable[]
  readonly club: Browsable | undefined
  readonly squad: readonly Player[]
  readonly date: DayNumber
  readonly sort: Sort<SquadSortKey> | null
  readonly onSort: (sort: Sort<SquadSortKey> | null) => void
  readonly onPick: (id: ClubId) => void
  readonly translator: Translator
}

function ClubBrowser({
  clubs,
  club,
  squad,
  date,
  sort,
  onSort,
  onPick,
  translator,
}: ClubBrowserProps) {
  const { t, money, locale } = translator

  // Position, then quality — the order Plantilla uses, so a rival squad reads the
  // way your own does.
  const ordered = [...squad].sort(
    (a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || overall(b) - overall(a),
  )
  const rows = sortedBy(
    ordered,
    sort,
    (player, key) => squadValue(player, key, squad, date),
    locale,
  )

  const column = (key: SquadSortKey, label: string) => (
    <SortHeader
      column={key}
      label={label}
      sort={sort}
      onSort={onSort}
      align={SQUAD_SORT_ALIGN[key]}
    />
  )

  return (
    <>
      <div className="market-screen__filters">
        <label className="field__label" htmlFor="browse-club">
          {t('market.browseClub')}
        </label>
        {/* Grouped, because the list is fifty-one clubs across nine places and a
            flat one is unreadable. Home first — it is the league you are in. */}
        <select
          id="browse-club"
          className="select"
          value={club?.id ?? ''}
          onChange={(event) => onPick(event.target.value as ClubId)}
        >
          <optgroup label={t('market.atHome')}>
            {clubs
              .filter((c) => c.country === undefined)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
          {COUNTRIES.map((country) => {
            const inCountry = clubs.filter((c) => c.country === country)
            if (inCountry.length === 0) return null
            return (
              <optgroup key={country} label={t(`country.${country}`)}>
                {inCountry.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
        <span className="market-screen__count">
          {t('market.squadSize', { count: squad.length })}
        </span>
      </div>

      <table className="data-table">
        <thead className="data-table__head">
          <tr>
            {column('position', t('market.column.position'))}
            {column('name', t('market.column.player'))}
            {column('age', t('market.column.age'))}
            {column('overall', t('market.column.overall'))}
            {column('wants', t('market.column.wants'))}
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => (
            <tr key={player.id} className="data-table__row">
              <td className="is-text">
                {positionChip(player.position, t(`position.${player.position}`))}
              </td>
              <td className="is-text">
                <PlayerLink player={player} />
              </td>
              <td>{ageOn(player, date)}</td>
              <td>{overall(player)}</td>
              <td>{money(scoutedPrice(squad, player, date))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

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
