import {
  debtLimit,
  formatMoney,
  type Ledger,
  ledgerNet,
  ROUNDS_PER_HALF,
  wageBill,
} from '@fm/domain'
import { useGame } from '../store.ts'
import './CajaScreen.css'

/**
 * The books.
 *
 * M5a built an economy the manager could not see: a balance that moved with no
 * account of why. Every figure here comes straight off `Club.ledger` — the same
 * record the balance identity is checked against — so the screen cannot disagree
 * with the game.
 *
 * Two columns, because one season of accounts on its own says nothing. Last
 * season is what `Club.lastLedger` is for.
 */

interface Line {
  readonly key: keyof Ledger
  readonly label: string
  /** Outgoings are shown negative; the ledger stores every line positive. */
  readonly out: boolean
}

/**
 * Stated as a table rather than eight hand-written rows, so a ninth ledger line
 * cannot be added to the domain and quietly go unshown here.
 */
export const LINES: readonly Line[] = [
  { key: 'gate', label: 'Gate', out: false },
  { key: 'tv', label: 'Televisión', out: false },
  { key: 'sponsor', label: 'Patrocinio', out: false },
  { key: 'prize', label: 'Premios', out: false },
  { key: 'transfers', label: 'Traspasos', out: false },
  { key: 'wages', label: 'Salarios', out: true },
  { key: 'bonuses', label: 'Primas de fichaje', out: true },
  { key: 'interest', label: 'Intereses', out: true },
  { key: 'stadium', label: 'Obras', out: true },
]

/** What a line is worth to the balance — negative for an outgoing. */
export function signed(ledger: Ledger, line: Line): number {
  return line.out ? -ledger[line.key] : ledger[line.key]
}

export function CajaScreen() {
  const game = useGame((s) => s.game)
  const go = useGame((s) => s.go)

  const club = game.clubs.find((c) => c.id === game.managedClubId)
  if (club === undefined) return null

  const squad = game.squads[club.id] ?? []
  const limit = debtLimit(club, game.competition.clubIds.length, ROUNDS_PER_HALF)
  const net = ledgerNet(club.ledger)

  return (
    <div className="caja-screen">
      <section className="screen caja-screen__main">
        <h2 className="screen__heading">Cuentas</h2>
        <table className="data-table">
          <thead className="data-table__head">
            <tr>
              <th className="is-text">Concepto</th>
              <th>Esta temporada</th>
              <th>Anterior</th>
            </tr>
          </thead>
          <tbody>
            {LINES.map((line) => {
              const now = signed(club.ledger, line)
              const then = signed(club.lastLedger, line)
              return (
                <tr key={line.key} className="data-table__row">
                  <td className="is-text">{line.label}</td>
                  <td className={amountClass(now)}>{formatMoney(now)}</td>
                  <td className={`data-table__num ${amountClass(then)}`}>{formatMoney(then)}</td>
                </tr>
              )
            })}
            <tr className="data-table__row caja-screen__total">
              <td className="is-text">
                <strong>Resultado</strong>
              </td>
              <td className={amountClass(net)}>
                <strong>{formatMoney(net)}</strong>
              </td>
              <td className={amountClass(ledgerNet(club.lastLedger))}>
                <strong>{formatMoney(ledgerNet(club.lastLedger))}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="screen__note">
          Every movement of your balance is one of these lines and nothing else. The season&rsquo;s
          books start again each August, once the prize money has landed.
        </p>
      </section>

      <aside className="caja-screen__side">
        <section className="screen caja-screen__panel">
          <div className="caja-screen__stats">
            <div className="stat">
              <span className="stat__label">Saldo</span>
              <span className={`stat__value caja-screen__figure ${amountClass(club.budget)}`}>
                {formatMoney(club.budget)}
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Descubierto</span>
              <span className="stat__value caja-screen__figure">{formatMoney(-limit)}</span>
            </div>
          </div>
          <p className="screen__note">
            You may spend into the red as far as your overdraft, and pay interest while you are
            there. The board does not judge you on it.
          </p>
        </section>

        <section className="screen caja-screen__panel">
          <h2 className="screen__heading">Salarios</h2>
          <div className="caja-screen__stats">
            <div className="stat">
              <span className="stat__label">Anual</span>
              <span className="stat__value caja-screen__figure">
                {formatMoney(wageBill(squad))}
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Plantilla</span>
              <span className="stat__value caja-screen__figure">{squad.length}</span>
            </div>
          </div>
          <p className="screen__note">
            Paid monthly. A club sitting on money pays over the odds, so a large balance costs you
            more than it earns.
          </p>
        </section>

        <div className="screen-actions">
          <button type="button" className="button" onClick={() => go('hub')}>
            Volver
          </button>
        </div>
      </aside>
    </div>
  )
}

/** Colour follows the sign; the number says it too, so colour is never the only signal. */
function amountClass(amount: number): string {
  if (amount > 0) return 'is-in'
  if (amount < 0) return 'is-out'
  return ''
}
