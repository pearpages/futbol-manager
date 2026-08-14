import { useState } from 'react'
import {
  ageOn,
  askingPrice,
  type Bid,
  bidIsLive,
  type ClubId,
  type DayNumber,
  formatMoney,
  isTransferWindowOpen,
  listedForSale,
  MAX_CONTRACT_YEARS,
  MIN_CONTRACT_YEARS,
  needFor,
  overall,
  type Player,
  type PlayerId,
  suggestedTerms,
  surplus,
} from '@fm/domain'
import { useGame } from '../store.ts'
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
  /** Marginal gain to your XI. Zero means he would sit on the bench. */
  readonly need: number
}

/**
 * Everything you could sign today, best improvement first.
 *
 * Exported so it can be tested without rendering — the same pattern `bandFor`
 * follows on the table screen.
 */
export function listingsFor(
  squad: readonly Player[],
  squadsByClub: Readonly<Record<string, readonly Player[]>>,
  freeAgents: readonly Player[],
  clubIds: readonly ClubId[],
  managedClubId: ClubId,
  date: DayNumber,
): Listing[] {
  const listings: Listing[] = []

  for (const clubId of clubIds) {
    if (clubId === managedClubId) continue
    for (const player of surplus(squadsByClub[clubId] ?? [])) {
      listings.push({
        player,
        from: clubId,
        fee: askingPrice(player, date),
        need: needFor(squad, player),
      })
    }
  }
  for (const player of freeAgents) {
    listings.push({ player, from: null, fee: 0, need: needFor(squad, player) })
  }

  return listings.sort((a, b) => b.need - a.need || overall(b.player) - overall(a.player))
}

export function MarketScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const inspect = useGame((s) => s.inspect)

  const [target, setTarget] = useState<PlayerId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyShortlist, setOnlyShortlist] = useState(false)

  const managed = game.managedClubId
  const squad = game.squads[managed] ?? []
  const club = game.clubs.find((c) => c.id === managed)
  const date = game.season.currentDate
  const open = isTransferWindowOpen(date)
  const names = new Map(game.clubs.map((c) => [c.id, c]))
  const shortlisted = new Set(game.shortlist)

  const all = listingsFor(
    squad,
    game.squads,
    game.freeAgents,
    game.competition.clubIds,
    managed,
    date,
  )
  const listings = (onlyShortlist ? all.filter((l) => shortlisted.has(l.player.id)) : all).slice(
    0,
    60,
  )

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

  /** Commands throw when they are refused; that message is the useful one. */
  function attempt(action: () => void) {
    try {
      action()
      setError(null)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'That is not allowed')
    }
  }

  const selected = target === null ? null : (all.find((l) => l.player.id === target) ?? null)

  return (
    <div className="market-screen">
      <section className="screen market-screen__main">
        <h2 className="screen__heading">Transfer market</h2>

        {!open && (
          <p className="screen__note">
            The window is shut. It opens in July and August, and again in January.
          </p>
        )}

        <div className="market-screen__filters">
          {/* A toggle, so the label names the mode and `aria-pressed` says whether
              it is on. Labelling it with the current state instead made the
              button you press to filter read "Whole market". */}
          <button
            type="button"
            className={`button${onlyShortlist ? ' is-primary' : ''}`}
            aria-pressed={onlyShortlist}
            onClick={() => setOnlyShortlist(!onlyShortlist)}
          >
            Shortlist only
          </button>
          <span className="market-screen__count">
            {listings.length} of {all.length} shown
          </span>
        </div>

        {listings.length === 0 ? (
          <p className="screen__note">
            {onlyShortlist ? 'Nothing shortlisted yet.' : 'Nobody is available.'}
          </p>
        ) : (
          <table className="data-table">
            <thead className="data-table__head">
              <tr>
                <th className="is-text">Pos</th>
                <th className="is-text">Player</th>
                <th className="is-text">Club</th>
                <th>Age</th>
                <th>Ovr</th>
                <th>Improves</th>
                <th>Asking</th>
                <th className="is-text">Act</th>
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
                    <td className="is-text">{positionChip(player.position)}</td>
                    <td className="is-text">
                      <button
                        type="button"
                        className="market-screen__name"
                        onClick={() => inspect(player.id)}
                      >
                        {player.name}
                      </button>
                    </td>
                    <td className="is-text">
                      {listing.from === null ? (
                        <span className="market-screen__free">Free agent</span>
                      ) : (
                        (names.get(listing.from)?.shortName ?? '???')
                      )}
                    </td>
                    <td>{ageOn(player, date)}</td>
                    <td>
                      <strong>{overall(player)}</strong>
                    </td>
                    <td className={listing.need > 0 ? 'market-screen__gain' : undefined}>
                      {listing.need > 0 ? `+${listing.need.toFixed(1)}` : '—'}
                    </td>
                    <td>{listing.fee === 0 ? 'Free' : formatMoney(listing.fee)}</td>
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
                        {shortlisted.has(player.id) ? 'Listed' : 'Watch'}
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
                        {listing.from === null ? 'Sign' : 'Bid'}
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
              <span className="stat__label">Budget</span>
              <span className="stat__value">{formatMoney(club?.budget ?? 0)}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Window</span>
              <span className="stat__value market-screen__window">{open ? 'Open' : 'Shut'}</span>
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
            listing={selected}
            bid={outgoing.find((b) => b.playerId === selected.player.id)}
            date={date}
            open={open}
            onAttempt={attempt}
            onClose={() => setTarget(null)}
          />
        )}

        <section className="screen market-screen__panel">
          <h2 className="screen__heading">Up for sale</h2>
          {onSale.length === 0 ? (
            <p className="screen__note">
              Nobody listed. Your squad is invisible to other clubs until you put someone on the
              market — list them from the squad screen.
            </p>
          ) : (
            <ul className="offer-list">
              {onSale.map((player) => (
                <li key={player.id} className="offer-list__item">
                  <span className="offer-list__name">{player.name}</span>
                  <span className="offer-list__detail">
                    {player.position} · asking {formatMoney(askingPrice(player, date))}
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
                      Take off
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="screen market-screen__panel market-screen__inbox">
          <h2 className="screen__heading">Offers for your players</h2>
          {incoming.length === 0 ? (
            <p className="screen__note">Nothing on the table.</p>
          ) : (
            <ul className="offer-list">
              {incoming.map((bid) => (
                <li key={bid.id} className="offer-list__item">
                  <span className="offer-list__name">
                    {byId.get(bid.playerId)?.name ?? 'Unknown'}
                  </span>
                  <span className="offer-list__detail">
                    {names.get(bid.from)?.shortName ?? '???'} · {formatMoney(bid.fee)}
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
                      Accept
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
                      Reject
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="screen market-screen__panel market-screen__outbox">
          <h2 className="screen__heading">Your bids</h2>
          {outgoing.length === 0 ? (
            <p className="screen__note">No bids outstanding.</p>
          ) : (
            <ul className="offer-list">
              {outgoing.map((bid) => (
                <li key={bid.id} className="offer-list__item">
                  <span className="offer-list__name">
                    {byId.get(bid.playerId)?.name ?? 'Unknown'}
                  </span>
                  <span className="offer-list__detail">
                    {formatMoney(bid.fee)} · {describeBid(bid)}
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
                      Open
                    </button>
                    <button
                      type="button"
                      className="button market-screen__mini"
                      onClick={() =>
                        attempt(() => dispatch({ type: 'WithdrawBid', bidId: bid.id }))
                      }
                    >
                      Withdraw
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

function describeBid(bid: Bid): string {
  if (bid.status === 'accepted') return 'Fee agreed — settle terms'
  if (bid.status === 'countered') return `They want ${formatMoney(bid.counterFee ?? bid.fee)}`
  return 'Awaiting an answer'
}

interface NegotiationProps {
  readonly listing: Listing
  readonly bid: Bid | undefined
  readonly date: DayNumber
  readonly open: boolean
  onAttempt(action: () => void): void
  onClose(): void
}

/**
 * One player, and whichever half of the deal is outstanding.
 *
 * A free agent skips straight to terms — there is no fee and nobody to negotiate
 * it with. Everyone else needs a fee agreed first, which is why the two steps are
 * visibly separate rather than one "buy" button.
 */
function NegotiationPanel({ listing, bid, date, open, onAttempt, onClose }: NegotiationProps) {
  const dispatch = useGame((s) => s.dispatch)
  const { player } = listing
  const wanted = suggestedTerms(player, date)

  const [fee, setFee] = useState(String(bid?.counterFee ?? listing.fee))
  const [wage, setWage] = useState(String(wanted.wage))
  const [years, setYears] = useState(String(wanted.years))

  const feeAgreed = listing.from === null || bid?.status === 'accepted'

  return (
    <section className="screen market-screen__panel">
      <h2 className="screen__heading">{player.name}</h2>

      <div className="market-screen__deal">
        {!feeAgreed && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="fee">
                Fee (thousands) · they ask {formatMoney(bid?.counterFee ?? listing.fee)}
              </label>
              <input
                id="fee"
                className="market-screen__input"
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
              {bid === undefined ? 'Make bid' : 'Bid again'}
            </button>
            <p className="screen__note market-screen__hint">
              A bid at or above the asking price is accepted. Below it they may name their own. An
              answer takes a couple of days.
            </p>
          </>
        )}

        {feeAgreed && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="wage">
                Wage a season (thousands) · he wants {formatMoney(wanted.wage)}
              </label>
              <input
                id="wage"
                className="market-screen__input"
                type="number"
                min={0}
                step={50}
                value={wage}
                onChange={(event) => setWage(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="years">
                Contract length in years
              </label>
              <input
                id="years"
                className="market-screen__input"
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
              {listing.from === null ? 'Sign him' : 'Offer terms'}
            </button>
            <p className="screen__note market-screen__hint">
              A fee buys the right to talk to him. He still has to want to come.
            </p>
          </>
        )}

        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  )
}
