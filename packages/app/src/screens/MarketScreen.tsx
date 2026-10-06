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
import { playersById } from '../players.ts'
import { useGame } from '../store.ts'
import { usePhone } from '../usePhone.ts'
import { ClubBadge } from './ClubBadge.tsx'
import { PlayerLink } from './PlayerLink.tsx'
import { useAttempt } from '../attempt.ts'
import { type Translator, useT } from '../i18n/useT.ts'
import {
  Button,
  Confirm,
  DataTable,
  Modal,
  Segments,
  Field,
  FieldLabel,
  NumberInput,
  Pager,
  Screen,
  ScreenActions,
  ScreenHeading,
  ScreenNote,
  type Sort,
  sortedBy,
  SortHeader,
  Stat,
  StatLabel,
  StatValue,
  VisuallyHidden,
} from '@fm/design-system'
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
const SORT_KEYS: readonly SortKey[] = ['overall', 'fee', 'age', 'name', 'club']

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

/**
 * How many listings a page shows.
 *
 * **The list is bounded, never capped.** M4b shipped a bare `.slice(0, 60)` with no
 * filter, no sort and no pager, and it hid ~90 affordable signings from a weak club
 * while showing it sixty players it could not buy. The difference is reachability:
 * every listing is still on some page, `Showing {shown} of {total}` still names the
 * true totals, and the filters and sorts act on the whole set before it is sliced.
 *
 * Bounding it is not only a rendering nicety. Unpaged, this screen put ~290 rows on
 * the page carrying ~900 controls — ~3,000 nodes repainted on every click and 900
 * tab stops for a keyboard user. `vitest.config.ts` had already named pagination as
 * the lever if the screen ever had to get cheaper.
 */
const PAGE_SIZE = 40

export function MarketScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const translator = useT()
  const { t, plural, money, locale } = translator

  const [target, setTarget] = useState<PlayerId | null>(null)
  const { error, attempt, clear: clearError } = useAttempt(game, translator)
  // An offer you are about to accept: a sale cannot be taken back, so it asks.
  const [selling, setSelling] = useState<Bid | null>(null)
  const [onlyShortlist, setOnlyShortlist] = useState(false)
  const [onlyAffordable, setOnlyAffordable] = useState(false)
  const [onlyFree, setOnlyFree] = useState(false)
  /** Empty means every position, so the default is unfiltered. */
  const [positions, setPositions] = useState<readonly Position[]>([])
  /** `null` is market order — the shuffle. A column cycles back to it. */
  const [sort, setSort] = useState<Sort<SortKey> | null>(null)
  /**
   * Which page of the listings.
   *
   * Guarded twice, because the two failures are different. Every control that
   * changes *what the table contains* resets it to zero, so filtering does not
   * strand you on a page your new filter has emptied. And it is clamped on render
   * for the case no handler can see: the clock ticks, a club sells, and the list
   * shrinks underneath a reader who is not touching anything.
   */
  const [page, setPage] = useState(0)
  const phone = usePhone()
  /** Which phone sheet is open: the filters or the order. */
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null)

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
  /*
   * The lookups below are memoised on `game` because they walk the whole world and
   * nothing about them changes when a filter is toggled — `playersById` alone is a
   * Map of ~1,250 players, and it was being rebuilt on every keystroke.
   *
   * **Worth ≤130ms a render, which is not why this screen was slow.** A full mount
   * including all of these, the filter, the sort and every row measures 132ms; the
   * cost was the row count, and pagination is what addresses it. Kept because it is
   * right, not because it is the lever.
   */
  // Foreign sellers too, or their listings show a blank club column.
  const names = useMemo(
    () =>
      new Map<ClubId, { name: string; shortName: string; id: ClubId }>(
        [...game.clubs, ...game.foreign.clubs].map((c) => [
          c.id,
          { id: c.id, name: c.name, shortName: c.shortName },
        ]),
      ),
    [game],
  )
  const shortlisted = useMemo(() => new Set(game.shortlist), [game])
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
  const rivals: readonly Browsable[] = useMemo(
    () => [
      ...game.clubs
        .filter((c) => c.id !== managed)
        .map((c) => ({ id: c.id, name: c.name, shortName: c.shortName })),
      ...game.foreign.clubs.map((c) => ({
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        country: c.country,
      })),
    ],
    [game, managed],
  )
  // **`null` means the grid, not the first club.** It used to fall back to
  // `rivals[0]`, which was right for a dropdown that must always show something
  // and wrong for a view whose landing state is every club at once.
  const browsed = browsing === null ? undefined : rivals.find((c) => c.id === browsing)
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

  // Clamped rather than corrected in an effect: derived state belongs in the render
  // that derives it, which is the lesson `NegotiationPanel`'s remount-by-key paid
  // for. `current` is what the pager reads and writes — using `page` anywhere below
  // would let a stale index leak back the moment the list grew again.
  const pageCount = Math.max(1, Math.ceil(listings.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const shownListings = listings.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  function toggle<T>(list: readonly T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  /**
   * Every control that changes what the table holds goes through here.
   *
   * Sorting counts: a column that reordered the whole market while leaving you on
   * page four would show you a slice of a list you had never seen the top of.
   */
  function changing(apply: () => void) {
    return () => {
      setPage(0)
      apply()
    }
  }

  /** The shared header, bound to this screen's sort state. */
  function column(key: SortKey, label: string, fullLabel?: string) {
    return (
      <SortHeader
        column={key}
        label={label}
        {...(fullLabel === undefined ? {} : { fullLabel })}
        sort={sort}
        onSort={(next) => {
          setPage(0)
          setSort(next)
        }}
        align={SORT_ALIGN[key]}
      />
    )
  }

  // What is actually on the market, not merely what you clicked: a player listed
  // in August may have won his place back by January, and `listedForSale` is what
  // the transfer window will really act on.
  const onSale = useMemo(() => listedForSale(game), [game])
  const outgoing = game.bids.filter((b) => b.from === managed && bidIsLive(b))
  const incoming = game.bids.filter((b) => b.to === managed && b.status === 'pending')
  // **Abroad counts.** This map is what names a bid row and what the deal panel
  // falls back to, so leaving the foreign squads out of it made a cross-border
  // signing impossible to finish: the row read "unknown" and *Open* did nothing.
  // Shared rather than built here, so the next lookup cannot miss a squad again.
  const byId = useMemo(() => playersById(game), [game])

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

  // The same controls on both layouts: a row on the desk, a sheet on a phone.
  const filterButtons = (
    <>
      <span className="market-screen__positions">
        {POSITIONS.map((position) => (
          <Button
            primary={positions.includes(position)}
            key={position}
            type="button"
            className="market-screen__mini"
            aria-pressed={positions.includes(position)}
            onClick={changing(() => setPositions(toggle(positions, position)))}
          >
            {/* The translated code, not the raw enum. These sit directly
                above a Pos column that has always been translated, so in
                Catalan the filters read GK/DF/MF/FW over POR/DEF/MIG/DAV. */}
            {t(`position.${position}`)}
          </Button>
        ))}
      </span>
      <Button
        primary={onlyAffordable}
        type="button"
        className="market-screen__mini"
        aria-pressed={onlyAffordable}
        onClick={changing(() => setOnlyAffordable(!onlyAffordable))}
      >
        {t('market.withinBudget')}
      </Button>
      <Button
        primary={onlyFree}
        type="button"
        className="market-screen__mini"
        aria-pressed={onlyFree}
        onClick={changing(() => setOnlyFree(!onlyFree))}
      >
        {t('market.freeAgents')}
      </Button>
      <Button
        primary={onlyShortlist}
        type="button"
        className="market-screen__mini"
        aria-pressed={onlyShortlist}
        onClick={changing(() => setOnlyShortlist(!onlyShortlist))}
      >
        {t('market.shortlistOnly')}
      </Button>
    </>
  )
  const activeFilters =
    positions.length + Number(onlyAffordable) + Number(onlyFree) + Number(onlyShortlist)
  return (
    <div className="market-screen">
      <Screen className="market-screen__main">
        <ScreenHeading>{t('market.heading')}</ScreenHeading>

        {/* Two buttons with `aria-pressed`, not a `role="tablist"` — the same call
            `ResultsScreen` records, and for the same reason: a tablist owes
            arrow-key navigation to be honest about the role. */}
        <div className="market-screen__tabs">
          {(['forSale', 'clubs'] as const).map((key) => (
            <Button
              primary={tab === key}
              key={key}
              type="button"
              // The market's two places: what is for sale, and every club.
              icon={key === 'forSale' ? 'tag' : 'club'}
              aria-pressed={tab === key}
              onClick={changing(() => {
                setTab(key)
              })}
            >
              {t(`market.tab.${key}`)}
            </Button>
          ))}
        </div>

        {!open && <ScreenNote>{t('market.windowShut')}</ScreenNote>}

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
            {phone ? (
              // Phone: one row — the filters and the order each open a sheet, and
              // the list starts straight under it (ADR 0019).
              <div className="market-screen__filters">
                <Button
                  type="button"
                  icon="filter"
                  className="market-screen__mini"
                  onClick={() => {
                    setSheet('filters')
                  }}
                >
                  {activeFilters === 0
                    ? t('market.filters')
                    : t('market.filtersCount', { count: activeFilters })}
                </Button>
                <Button
                  type="button"
                  icon="sort"
                  className="market-screen__mini"
                  onClick={() => {
                    setSheet('sort')
                  }}
                >
                  {t('market.sortBy', { key: t(`market.sort.${sort?.key ?? 'market'}`) })}
                </Button>
                <span className="market-screen__count" role="status">
                  {t('market.showing', { shown: listings.length, total: all.length })}
                </span>
              </div>
            ) : (
              <div className="market-screen__filters">
                {filterButtons}
                {activeFilters > 0 && (
                  <Button
                    type="button"
                    icon="close"
                    className="market-screen__mini"
                    onClick={changing(() => {
                      setPositions([])
                      setOnlyAffordable(false)
                      setOnlyFree(false)
                      setOnlyShortlist(false)
                    })}
                  >
                    {t('market.clearFilters')}
                  </Button>
                )}
                <span className="market-screen__count" role="status">
                  {t('market.showing', { shown: listings.length, total: all.length })}
                </span>
              </div>
            )}

            {listings.length === 0 ? (
              <ScreenNote>{t('market.noMatches')}</ScreenNote>
            ) : (
              <DataTable className="market-screen__listings">
                <thead className="data-table__head">
                  <tr>
                    <th className="is-text">
                      <span aria-hidden="true">{t('market.column.position')}</span>
                      <VisuallyHidden>{t('column.full.position')}</VisuallyHidden>
                    </th>
                    {column('name', t('market.column.player'))}
                    {column('club', t('market.column.club'))}
                    {column('age', t('market.column.age'))}
                    {column('overall', t('market.column.overall'), t('column.full.overall'))}
                    {column('fee', t('market.column.asking'))}
                    <th className="is-text">
                      <span aria-hidden="true">{t('market.column.action')}</span>
                      <VisuallyHidden>{t('column.full.action')}</VisuallyHidden>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shownListings.map((listing) => {
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
                          <Button
                            icon={shortlisted.has(player.id) ? 'star-filled' : 'star'}
                            type="button"
                            className="market-screen__mini"
                            aria-label={t('market.watchPlayer', { player: player.name })}
                            aria-pressed={shortlisted.has(player.id)}
                            onClick={() =>
                              dispatch({
                                type: 'Shortlist',
                                playerId: player.id,
                                on: !shortlisted.has(player.id),
                              })
                            }
                          >
                            {/* One label: the filled star and `aria-pressed` say it is on,
                                and a name that changed too would say it twice. */}
                            {t('market.watch')}
                          </Button>
                          <Button
                            icon="cash"
                            primary
                            type="button"
                            className="market-screen__mini"
                            aria-label={t(
                              listing.from === null ? 'market.signPlayer' : 'market.bidPlayer',
                              { player: player.name },
                            )}
                            disabled={!open}
                            onClick={() => {
                              setTarget(player.id)
                              clearError()
                            }}
                          >
                            {listing.from === null ? t('market.sign') : t('market.bid')}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </DataTable>
            )}

            {pageCount > 1 && (
              <Pager
                className="market-screen__pager"
                prevLabel={t('market.prevPage')}
                nextLabel={t('market.nextPage')}
                atStart={current === 0}
                atEnd={current >= pageCount - 1}
                onPrev={() => {
                  setPage(current - 1)
                }}
                onNext={() => {
                  setPage(current + 1)
                }}
              >
                <span className="pager__label">
                  {t('market.page', { page: current + 1, pages: pageCount })}
                </span>
              </Pager>
            )}
          </>
        )}
      </Screen>

      <aside className="market-screen__side">
        <Screen className="market-screen__panel">
          <div className="market-screen__money">
            <Stat>
              <StatLabel>{t('market.budget')}</StatLabel>
              <StatValue>{money(club?.budget ?? 0)}</StatValue>
            </Stat>
            {/* The balance alone contradicts the filter beside it, which spends to
                the overdraft because the reducer does. This is the figure "Within
                budget" is actually testing against. */}
            <Stat>
              <StatLabel>{t('caja.available')}</StatLabel>
              <StatValue>{money(spendable)}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('market.window')}</StatLabel>
              <StatValue className="market-screen__window">
                {open ? t('market.windowOpen') : t('market.windowClosed')}
              </StatValue>
            </Stat>
          </div>
        </Screen>

        {error !== null && (
          <Screen className="market-screen__panel">
            <ScreenNote className="market-screen__error" role="alert">
              {error}
            </ScreenNote>
          </Screen>
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

        <Screen className={`market-screen__panel${onSale.length === 0 ? ' is-empty' : ''}`}>
          <ScreenHeading>{t('market.upForSale')}</ScreenHeading>
          {onSale.length === 0 ? (
            <ScreenNote>{t('market.nobodyListed')}</ScreenNote>
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
                    <Button
                      icon="close"
                      type="button"
                      className="market-screen__mini"
                      onClick={() =>
                        attempt(() =>
                          dispatch({ type: 'ListPlayer', playerId: player.id, on: false }),
                        )
                      }
                    >
                      {t('market.takeOff')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Screen>

        <Screen
          className={`market-screen__panel market-screen__inbox${incoming.length === 0 ? ' is-empty' : ''}`}
        >
          <ScreenHeading>{t('market.offersForYours')}</ScreenHeading>
          {incoming.length === 0 ? (
            <ScreenNote>{t('market.noOffers')}</ScreenNote>
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
                    <Button
                      icon="check"
                      primary
                      type="button"
                      className="market-screen__mini"
                      onClick={() => {
                        setSelling(bid)
                      }}
                    >
                      {t('market.accept')}
                    </Button>
                    <Button
                      icon="close"
                      type="button"
                      className="market-screen__mini"
                      onClick={() =>
                        attempt(() =>
                          dispatch({ type: 'RespondToOffer', bidId: bid.id, accept: false }),
                        )
                      }
                    >
                      {t('market.reject')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Screen>

        {sheet === 'filters' && (
          <Modal
            title={t('market.filterTitle')}
            onClose={() => {
              setSheet(null)
            }}
          >
            <div className="market-screen__sheet-filters">{filterButtons}</div>
            <ScreenActions>
              <Button
                type="button"
                icon="close"
                disabled={activeFilters === 0}
                onClick={changing(() => {
                  setPositions([])
                  setOnlyAffordable(false)
                  setOnlyFree(false)
                  setOnlyShortlist(false)
                })}
              >
                {t('market.clearFilters')}
              </Button>
              <Button
                primary
                type="button"
                onClick={() => {
                  setSheet(null)
                }}
              >
                {plural('market.showN', listings.length)}
              </Button>
            </ScreenActions>
          </Modal>
        )}

        {sheet === 'sort' && (
          <Modal
            title={t('market.sortTitle')}
            onClose={() => {
              setSheet(null)
            }}
          >
            <Segments
              className="market-screen__order-keys"
              label={t('market.sortTitle')}
              options={(['market', ...SORT_KEYS] as const).map((key) => ({
                value: key,
                label: t(`market.sort.${key}`),
              }))}
              value={sort?.key ?? 'market'}
              onChange={(key) => {
                setPage(0)
                setSort(key === 'market' ? null : { key, desc: sort?.desc ?? true })
              }}
            />
            {sort !== null && (
              <Segments
                label={t('market.sortTitle')}
                options={[
                  { value: 'desc', label: t('market.sort.desc') },
                  { value: 'asc', label: t('market.sort.asc') },
                ]}
                value={sort.desc ? 'desc' : 'asc'}
                onChange={(direction) => {
                  setPage(0)
                  setSort({ key: sort.key, desc: direction === 'desc' })
                }}
              />
            )}
            <ScreenActions>
              <Button
                primary
                type="button"
                onClick={() => {
                  setSheet(null)
                }}
              >
                {plural('market.showN', listings.length)}
              </Button>
            </ScreenActions>
          </Modal>
        )}

        {selling !== null &&
          (() => {
            const name = byId.get(selling.playerId)?.name ?? '???'
            return (
              <Confirm
                title={t('confirm.sell.title', { name })}
                confirmLabel={t('market.accept')}
                confirmIcon="check"
                cancelLabel={t('action.cancel')}
                onConfirm={() => {
                  setSelling(null)
                  attempt(() =>
                    dispatch({ type: 'RespondToOffer', bidId: selling.id, accept: true }),
                  )
                }}
                onCancel={() => {
                  setSelling(null)
                }}
              >
                <p>{t('confirm.sell.body', { fee: money(selling.fee), name })}</p>
                <p>{t('confirm.irreversible')}</p>
              </Confirm>
            )
          })()}

        <Screen
          className={`market-screen__panel market-screen__outbox${outgoing.length === 0 ? ' is-empty' : ''}`}
        >
          <ScreenHeading>{t('market.yourBids')}</ScreenHeading>
          {outgoing.length === 0 ? (
            <ScreenNote>{t('market.noBids')}</ScreenNote>
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
                    <Button
                      icon="chevron"
                      type="button"
                      className="market-screen__mini"
                      onClick={() => {
                        setTarget(bid.playerId)
                        clearError()
                      }}
                    >
                      {t('market.openNegotiation')}
                    </Button>
                    <Button
                      icon="undo"
                      type="button"
                      className="market-screen__mini"
                      onClick={() =>
                        attempt(() => dispatch({ type: 'WithdrawBid', bidId: bid.id }))
                      }
                    >
                      {t('market.withdraw')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Screen>
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
  readonly onPick: (id: ClubId | null) => void
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

  const column = (key: SquadSortKey, label: string, fullLabel?: string) => (
    <SortHeader
      column={key}
      label={label}
      {...(fullLabel === undefined ? {} : { fullLabel })}
      sort={sort}
      onSort={onSort}
      align={SQUAD_SORT_ALIGN[key]}
    />
  )

  // **No club chosen means the wall of crests, not the first club on the list.**
  // Fifty-one clubs across nine countries is a thing to look at rather than a
  // thing to pick from a control two lines tall, and every one of them has had a
  // badge since the foreign layer landed — the dropdown simply never showed one.
  if (club === undefined) {
    const group = (label: string, inGroup: readonly Browsable[]) =>
      inGroup.length === 0 ? null : (
        <section key={label} className="club-grid__group">
          <h3 className="club-grid__country">{label}</h3>
          <div className="club-grid__clubs">
            {inGroup.map((c) => (
              <button
                key={c.id}
                type="button"
                className="club-grid__club"
                onClick={() => onPick(c.id)}
              >
                {/* The badge stays `aria-hidden`, so the button is named by the
                    club's name alone. It also keeps the tile from reading its own
                    club twice — the badge carries the three-letter code and the
                    label the full name, which is the same fix the market table's
                    club column needed when it rendered "GRAGRA". */}
                <ClubBadge club={c} size="lg" />
                <span className="club-grid__name">{c.name}</span>
              </button>
            ))}
          </div>
        </section>
      )

    return (
      <div className="club-grid">
        {/* Home first — it is the league you are in. Then the countries in the
            order `COUNTRIES` declares, and within each the order the data ships,
            which is descending by rating. */}
        {group(
          t('market.atHome'),
          clubs.filter((c) => c.country === undefined),
        )}
        {COUNTRIES.map((country) =>
          group(
            t(`country.${country}`),
            clubs.filter((c) => c.country === country),
          ),
        )}
      </div>
    )
  }

  return (
    <>
      <div className="market-screen__filters">
        {/* Its own label rather than `action.back`. The market screen already has
            a Volver at the foot of its rail, and a second button with that name
            makes `testing.ts`'s `back()` ambiguous — which would break tests that
            have nothing to do with this screen. */}
        <Button icon="back" type="button" onClick={() => onPick(null)}>
          {t('market.allClubs')}
        </Button>
        <ClubBadge club={club} size="sm" />
        <span className="club-grid__heading">{club.name}</span>
        <span className="market-screen__count" role="status">
          {t('market.squadSize', { count: squad.length })}
        </span>
      </div>

      <DataTable>
        <thead className="data-table__head">
          <tr>
            {column('position', t('market.column.position'), t('column.full.position'))}
            {column('name', t('market.column.player'))}
            {column('age', t('market.column.age'))}
            {column('overall', t('market.column.overall'), t('column.full.overall'))}
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
      </DataTable>
    </>
  )
}

function NegotiationPanel({ listing, bid, date, open, ref, onAttempt, onClose }: NegotiationProps) {
  const dispatch = useGame((s) => s.dispatch)
  const dispatchAll = useGame((s) => s.dispatchAll)
  const budget = useGame((s) => s.game.clubs.find((c) => c.id === s.game.managedClubId)?.budget)
  const { t, plural, money, percent } = useT()
  // Signing spends the fee and commits the wage for years: it asks first.
  const [signing, setSigning] = useState(false)
  const { player } = listing
  const wanted = suggestedTerms(player, date)

  const [fee, setFee] = useState(String(bid?.counterFee ?? listing.fee))
  const [wage, setWage] = useState(String(wanted.wage))
  const [years, setYears] = useState(String(wanted.years))

  const feeAgreed = listing.from === null || bid?.status === 'accepted'

  return (
    <Screen className="market-screen__panel" ref={ref}>
      {/* The name is the heading *and* a way into his ficha — this panel asks
          you to commit money to a man whose card was two screens away. A button
          inside a heading still computes into the heading's accessible name, so
          `getByRole('heading', { name })` is unaffected. */}
      <ScreenHeading>
        <PlayerLink player={player} />
      </ScreenHeading>

      <div className="market-screen__deal">
        {!feeAgreed && (
          <>
            <Field>
              <FieldLabel htmlFor="fee">
                {t('market.feeField', { fee: money(bid?.counterFee ?? listing.fee) })}
              </FieldLabel>
              <NumberInput
                id="fee"
                type="number"
                min={1}
                step={50}
                value={fee}
                onChange={(event) => setFee(event.target.value)}
              />
            </Field>
            <Button
              icon="cash"
              primary
              type="button"
              disabled={!open}
              onClick={() =>
                // As one: a refused new bid leaves the old one standing.
                onAttempt(() => {
                  const make = { type: 'MakeBid', playerId: player.id, fee: Number(fee) } as const
                  dispatchAll(
                    bid === undefined
                      ? [make]
                      : [{ type: 'WithdrawBid', bidId: bid.id } as const, make],
                  )
                })
              }
            >
              {t(bid === undefined ? 'market.makeBid' : 'market.bidAgain')}
            </Button>
            {/* The bonus was charged silently — `affordable` has always counted it,
                so the only way to find out it existed was to be refused, or to read
                it off the accounts a week later as a line you did not authorise. */}
            <ScreenNote className="market-screen__hint">
              {t('market.outlay', {
                bonus: money(signingOutlay(Number(fee) || 0) - (Number(fee) || 0)),
                total: money(signingOutlay(Number(fee) || 0)),
                percent: percent(FINANCE.SIGNING_BONUS),
              })}
            </ScreenNote>
            <ScreenNote className="market-screen__hint">{t('market.bidHint')}</ScreenNote>
          </>
        )}

        {feeAgreed && (
          <>
            <Field>
              <FieldLabel htmlFor="wage">
                {t('market.wageField', { wage: money(wanted.wage) })}
              </FieldLabel>
              <NumberInput
                id="wage"
                type="number"
                min={0}
                step={50}
                value={wage}
                onChange={(event) => setWage(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="years">{t('market.yearsField')}</FieldLabel>
              <NumberInput
                id="years"
                type="number"
                min={MIN_CONTRACT_YEARS}
                max={MAX_CONTRACT_YEARS}
                step={1}
                value={years}
                onChange={(event) => setYears(event.target.value)}
              />
            </Field>
            <Button
              icon="sign"
              primary
              type="button"
              disabled={!open}
              onClick={() => {
                setSigning(true)
              }}
            >
              {t(listing.from === null ? 'market.signHim' : 'market.offerTerms')}
            </Button>
            {signing &&
              (() => {
                const outlay = bid === undefined ? 0 : signingOutlay(bid.fee)
                return (
                  <Confirm
                    title={t('confirm.sign.title', { name: player.name })}
                    confirmLabel={t(listing.from === null ? 'market.signHim' : 'market.offerTerms')}
                    confirmIcon="sign"
                    cancelLabel={t('action.cancel')}
                    onConfirm={() => {
                      setSigning(false)
                      onAttempt(() =>
                        dispatch({
                          type: 'OfferContract',
                          playerId: player.id,
                          wage: Number(wage),
                          years: Number(years),
                        }),
                      )
                    }}
                    onCancel={() => {
                      setSigning(false)
                    }}
                  >
                    <p>
                      {plural('confirm.sign.terms', Number(years), { wage: money(Number(wage)) })}
                    </p>
                    {outlay > 0 && <p>{t('confirm.sign.fee', { total: money(outlay) })}</p>}
                    {budget !== undefined && (
                      <p>{t('confirm.sign.left', { left: money(budget - outlay) })}</p>
                    )}
                  </Confirm>
                )
              })()}
            <ScreenNote className="market-screen__hint">{t('market.termsHint')}</ScreenNote>
          </>
        )}

        <Button icon="close" type="button" onClick={onClose}>
          {t('action.close')}
        </Button>
      </div>
    </Screen>
  )
}
