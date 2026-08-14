import { useState } from 'react'
import {
  computeTable,
  expansionCost,
  FINANCE,
  formatMoney,
  gateReceipts,
  occupancy,
  ROUNDS_PER_HALF,
} from '@fm/domain'
import { useGame } from '../store.ts'
import './EstadioScreen.css'

/**
 * The ground, and the two levers on it.
 *
 * **The decision is the pair, not either one.** A dearer ticket takes more per
 * head and empties seats; expansion only pays if you are filling the ones you
 * have. Price high and build, and you have bought an empty stand.
 *
 * Price on its own is a revenue optimisation with one right answer, and that is
 * worth admitting rather than dressing up: what would make it a genuine dilemma
 * is supporters who resent being gouged, and that needs morale, which is M6.
 */

/**
 * A ticket, in euros.
 *
 * `formatMoney` works in thousands, which is right for every other figure in the
 * game and useless here — a seat at 0.0069 thousands renders as "€0k". This is
 * the one price a supporter would recognise, so it is shown as one.
 */
export function formatTicket(price: number): string {
  return `€${(price * 1000).toFixed(2)}`
}

/** The bar primitive wants a 0–20 bucket, not a percentage. */
export function fillFor(fraction: number): number {
  return Math.max(0, Math.min(20, Math.round(fraction * 20)))
}

export function EstadioScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const go = useGame((s) => s.go)

  const [seats, setSeats] = useState(4000)
  const [error, setError] = useState<string | null>(null)

  const club = game.clubs.find((c) => c.id === game.managedClubId)
  if (club === undefined) return null

  const clubCount = game.competition.clubIds.length
  const table = computeTable(game.competition.clubIds, game.season.fixtures)
  const standing = table.findIndex((row) => row.clubId === club.id) + 1
  const position = standing > 0 ? standing : null

  const full = occupancy(club, position, clubCount)
  const perMatch = gateReceipts(club, position, clubCount)
  const cost = expansionCost(seats)

  const low = FINANCE.TICKET * FINANCE.MIN_TICKET_FACTOR
  const high = FINANCE.TICKET * FINANCE.MAX_TICKET_FACTOR
  const step = (high - low) / 40

  // The screen never decides anything: it dispatches and reports the refusal.
  const attempt = (action: () => void) => {
    try {
      action()
      setError(null)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'That is not allowed')
    }
  }

  return (
    <div className="estadio-screen">
      <section className="screen estadio-screen__main">
        <h2 className="screen__heading">El campo</h2>

        <div className="estadio-screen__body">
          <div className="estadio-screen__stats">
            <div className="stat">
              <span className="stat__label">Aforo</span>
              <span className="stat__value estadio-screen__figure">
                {club.capacity.toLocaleString('en')}
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Ocupación</span>
              <span className="stat__value estadio-screen__figure">{Math.round(full * 100)}%</span>
            </div>
            <div className="stat">
              <span className="stat__label">Por partido</span>
              <span className="stat__value estadio-screen__figure">{formatMoney(perMatch)}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Temporada</span>
              <span className="stat__value estadio-screen__figure">
                {formatMoney(perMatch * ROUNDS_PER_HALF)}
              </span>
            </div>
          </div>

          {/* The ficha's bar primitive, reused. Width comes from a bucketed
              `data-fill`, never a JSX style prop. */}
          <div className="attr estadio-screen__gauge">
            <span className="attr__label">Lleno</span>
            <span className="attr__track">
              <span className="attr__fill" data-fill={fillFor(full)} />
            </span>
            <span className="attr__value">{Math.round(full * 100)}</span>
          </div>

          <div className="field estadio-screen__field">
            <label className="field__label" htmlFor="ticket">
              Precio · {formatTicket(club.ticketPrice)} por asiento
            </label>
            <input
              id="ticket"
              className="slider"
              type="range"
              min={low}
              max={high}
              step={step}
              value={club.ticketPrice}
              onChange={(event) =>
                attempt(() => {
                  dispatch({ type: 'SetTicketPrice', price: Number(event.target.value) })
                })
              }
            />
            <p className="estadio-screen__hint">
              Charging more takes more per head and leaves seats empty. There is a best price, and
              it moves with how good you are and where you sit.
            </p>
          </div>
        </div>
      </section>

      <aside className="estadio-screen__side">
        <section className="screen estadio-screen__panel">
          <h2 className="screen__heading">Obras</h2>
          {club.expansion !== null ? (
            <p className="screen__note">
              {club.expansion.seats.toLocaleString('en')} new seats are being built, ready for{' '}
              {club.expansion.readyYear}/{String(club.expansion.readyYear + 1).slice(2)}. One job at
              a time.
            </p>
          ) : (
            <div className="estadio-screen__body">
              <div className="field">
                <label className="field__label" htmlFor="seats">
                  Asientos · {formatMoney(cost)}
                </label>
                <input
                  id="seats"
                  className="number-input"
                  type="number"
                  min={FINANCE.MIN_EXPANSION}
                  max={FINANCE.MAX_EXPANSION}
                  step={500}
                  value={seats}
                  onChange={(event) => setSeats(Number(event.target.value))}
                />
              </div>
              <p className="estadio-screen__hint">
                Paid now, ready next season. Seats are only worth building if you are filling the
                ones you have.
              </p>
              <div className="screen-actions estadio-screen__build">
                <button
                  type="button"
                  className="button is-primary"
                  onClick={() =>
                    attempt(() => {
                      dispatch({ type: 'StartExpansion', seats })
                    })
                  }
                >
                  Comenzar obras
                </button>
              </div>
            </div>
          )}
        </section>

        {error !== null && (
          <section className="screen estadio-screen__panel">
            <p className="screen__note is-out" role="alert">
              {error}
            </p>
          </section>
        )}

        <div className="screen-actions">
          <button type="button" className="button" onClick={() => go('hub')}>
            Volver
          </button>
        </div>
      </aside>
    </div>
  )
}
