import {
  debtLimit,
  type Ledger,
  ledgerNet,
  type Projection,
  ROUNDS_PER_HALF,
  seasonProjection,
  wageBill,
} from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import {
  DataTable,
  Screen,
  ScreenHeading,
  ScreenNote,
  Stat,
  StatLabel,
  StatValue,
} from '@fm/design-system'
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
  { key: 'gate', label: 'caja.line.gate', out: false },
  { key: 'tv', label: 'caja.line.tv', out: false },
  { key: 'sponsor', label: 'caja.line.sponsor', out: false },
  { key: 'prize', label: 'caja.line.prize', out: false },
  { key: 'transfers', label: 'caja.line.transfers', out: false },
  { key: 'wages', label: 'caja.line.wages', out: true },
  { key: 'bonuses', label: 'caja.line.bonuses', out: true },
  { key: 'interest', label: 'caja.line.interest', out: true },
  { key: 'stadium', label: 'caja.line.stadium', out: true },
]

/** What a line is worth to the balance — negative for an outgoing. */
export function signed(ledger: Ledger, line: Line): number {
  return line.out ? -ledger[line.key] : ledger[line.key]
}

/**
 * The forecast's lines, reusing the accounts' own labels so the two panels name
 * the same thing the same way.
 *
 * Only the recurring five. Transfers, signing bonuses and building work are
 * decisions rather than income, and a forecast that guessed at them would be
 * predicting what the manager is about to do.
 */
type ProjectedKey = Extract<keyof Projection, 'gate' | 'tv' | 'sponsor' | 'prize' | 'wages'>

export const PROJECTED: readonly { key: ProjectedKey; label: string; out: boolean }[] = [
  { key: 'gate', label: 'caja.line.gate', out: false },
  { key: 'tv', label: 'caja.line.tv', out: false },
  { key: 'sponsor', label: 'caja.line.sponsor', out: false },
  { key: 'prize', label: 'caja.line.prize', out: false },
  { key: 'wages', label: 'caja.line.wages', out: true },
]

export function CajaScreen() {
  const game = useGame((s) => s.game)
  const { t, money } = useT()

  const club = game.clubs.find((c) => c.id === game.managedClubId)
  if (club === undefined) return null

  const squad = game.squads[club.id] ?? []
  const limit = debtLimit(club, game.competition.clubIds.length, ROUNDS_PER_HALF)
  const net = ledgerNet(club.ledger)
  const forecast = seasonProjection(club, squad, game.competition.clubIds, game.season.fixtures)

  return (
    <div className="caja-screen">
      <Screen className="caja-screen__main">
        <ScreenHeading>{t('caja.heading')}</ScreenHeading>
        <DataTable>
          <thead className="data-table__head">
            <tr>
              <th className="is-text">{t('caja.column.line')}</th>
              <th>{t('caja.column.thisSeason')}</th>
              <th>{t('caja.column.lastSeason')}</th>
            </tr>
          </thead>
          <tbody>
            {LINES.map((line) => {
              const now = signed(club.ledger, line)
              const then = signed(club.lastLedger, line)
              return (
                <tr key={line.key} className="data-table__row">
                  <th scope="row" className="is-text">
                    {t(line.label)}
                  </th>
                  <td className={amountClass(now)}>{money(now)}</td>
                  <td className={`data-table__num ${amountClass(then)}`}>{money(then)}</td>
                </tr>
              )
            })}
            <tr className="data-table__row caja-screen__total">
              <th scope="row" className="is-text">
                <strong>{t('caja.result')}</strong>
              </th>
              <td className={amountClass(net)}>
                <strong>{money(net)}</strong>
              </td>
              <td className={amountClass(ledgerNet(club.lastLedger))}>
                <strong>{money(ledgerNet(club.lastLedger))}</strong>
              </td>
            </tr>
          </tbody>
        </DataTable>
        <ScreenNote>{t('caja.note')}</ScreenNote>
      </Screen>

      <aside className="caja-screen__side">
        <Screen className="caja-screen__panel">
          <div className="caja-screen__stats">
            <Stat>
              <StatLabel>{t('caja.balance')}</StatLabel>
              <StatValue className={`caja-screen__figure ${amountClass(club.budget)}`}>
                {money(club.budget)}
              </StatValue>
            </Stat>
            {/* What you can actually commit, which is the number a manager wants
                before he bids — and the one the reducer itself tests against. */}
            <Stat>
              <StatLabel>{t('caja.available')}</StatLabel>
              <StatValue className={`caja-screen__figure ${amountClass(club.budget + limit)}`}>
                {money(club.budget + limit)}
              </StatValue>
            </Stat>
            {/* Stated positive, and labelled as a ceiling. Rendered as `-limit` it
                read as money owed sitting next to a balance that was in credit —
                which is the one thing this panel must not be able to say. */}
            <Stat>
              <StatLabel>{t('caja.overdraftLimit')}</StatLabel>
              <StatValue className="caja-screen__figure">{money(limit)}</StatValue>
            </Stat>
          </div>
          <ScreenNote>{t('caja.overdraftNote')}</ScreenNote>
        </Screen>

        <Screen className="caja-screen__panel">
          <ScreenHeading>{t('caja.projection')}</ScreenHeading>
          <DataTable className="caja-screen__projection">
            <tbody>
              {PROJECTED.map((line) => (
                <tr key={line.key} className="data-table__row">
                  <th scope="row" className="is-text">
                    {t(line.label)}
                  </th>
                  <td className={amountClass(line.out ? -forecast[line.key] : forecast[line.key])}>
                    {money(line.out ? -forecast[line.key] : forecast[line.key])}
                  </td>
                </tr>
              ))}
              <tr className="data-table__row caja-screen__total">
                <th scope="row" className="is-text">
                  <strong>{t('caja.result')}</strong>
                </th>
                <td className={amountClass(forecast.net)}>
                  <strong>{money(forecast.net)}</strong>
                </td>
              </tr>
            </tbody>
          </DataTable>
          <ScreenNote>
            {t(forecast.position === null ? 'caja.projectionNoteEarly' : 'caja.projectionNote', {
              position: forecast.position ?? 0,
            })}
          </ScreenNote>
        </Screen>

        <Screen className="caja-screen__panel">
          <ScreenHeading>{t('caja.wages')}</ScreenHeading>
          <div className="caja-screen__stats">
            <Stat>
              <StatLabel>{t('caja.annual')}</StatLabel>
              <StatValue className="caja-screen__figure">{money(wageBill(squad))}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('caja.squad')}</StatLabel>
              <StatValue className="caja-screen__figure">{squad.length}</StatValue>
            </Stat>
          </div>
          <ScreenNote>{t('caja.wagesNote')}</ScreenNote>
        </Screen>
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
