import { useState } from 'react'
import {
  computeTable,
  expansionCost,
  FINANCE,
  gateReceipts,
  occupancy,
  ROUNDS_PER_HALF,
} from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { useAttempt } from '../attempt.ts'
import { Explain } from './Explain.tsx'
import { stadiumArtFor } from './stadium.ts'
import { StadiumView } from './StadiumView.tsx'
import {
  AttrBar,
  Button,
  Confirm,
  Field,
  FieldLabel,
  Hint,
  NumberInput,
  Screen,
  ScreenActions,
  ScreenHeading,
  ScreenNote,
  Slider,
  Stat,
  StatLabel,
  StatValue,
} from '@fm/design-system'
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

/** The bar primitive wants a 0–20 bucket, not a percentage. */
export function fillFor(fraction: number): number {
  return Math.max(0, Math.min(20, Math.round(fraction * 20)))
}

export function EstadioScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const translator = useT()
  const { t, plural, money, ticket, count, season } = translator

  const [seats, setSeats] = useState(4000)
  // Works are paid the day they start, so starting them asks first.
  const [building, setBuilding] = useState(false)
  // The screen never decides anything: it dispatches and reports the refusal.
  const { error, attempt } = useAttempt(game, translator)

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

  return (
    <div className="estadio-screen">
      <Screen className="estadio-screen__main">
        <ScreenHeading>{t('estadio.heading')}</ScreenHeading>

        <div className="estadio-screen__body">
          {/* The ground: what is built, solid, and what could be, faded. It reads
              `capacity`, so it grows when the seats arrive at the rollover rather
              than when the work is commissioned — which is what `estadio.underWay`
              already promises while the building is going on. */}
          <div className="estadio-screen__ground">
            <StadiumView art={stadiumArtFor(club.capacity, club.id)} />
          </div>

          <div className="estadio-screen__stats">
            <Stat>
              <StatLabel>{t('estadio.capacity')}</StatLabel>
              <StatValue className="estadio-screen__figure">{count(club.capacity)}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>
                {t('estadio.occupancy')}
                <Explain topic="occupancy" />
              </StatLabel>
              <StatValue className="estadio-screen__figure">{Math.round(full * 100)}%</StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('estadio.perMatch')}</StatLabel>
              <StatValue className="estadio-screen__figure">{money(perMatch)}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('estadio.season')}</StatLabel>
              <StatValue className="estadio-screen__figure">
                {money(perMatch * ROUNDS_PER_HALF)}
              </StatValue>
            </Stat>
          </div>

          {/* The ficha's bar primitive, reused. Width comes from a bucketed
              `data-fill`, never a JSX style prop. */}
          <AttrBar className="estadio-screen__gauge">
            <span className="attr__label">{t('estadio.full')}</span>
            <span className="attr__track">
              <span className="attr__fill" data-fill={fillFor(full)} />
            </span>
            <span className="attr__value">{Math.round(full * 100)}</span>
          </AttrBar>

          <Field className="estadio-screen__field">
            {/* The "i" is a sibling of the label rather than inside it: a
                `<label for>` forwards a click to its control, so a button nested
                in one would focus the slider on the way to opening the dialog. */}
            <div className="estadio-screen__label-row">
              <FieldLabel htmlFor="ticket">
                {t('estadio.price', { price: ticket(club.ticketPrice) })}
              </FieldLabel>
              <Explain topic="ticket" />
            </div>
            <Slider
              id="ticket"
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
            <Hint>{t('estadio.priceHint')}</Hint>
          </Field>
        </div>
      </Screen>

      <aside className="estadio-screen__side">
        <Screen className="estadio-screen__panel">
          <ScreenHeading>
            {t('estadio.works')}
            <Explain topic="expansion" />
          </ScreenHeading>
          {club.expansion !== null ? (
            <ScreenNote>
              {plural('estadio.underWay', club.expansion.seats, {
                seats: count(club.expansion.seats),
                season: season(club.expansion.readyYear),
              })}
            </ScreenNote>
          ) : (
            <div className="estadio-screen__body">
              <Field>
                <FieldLabel htmlFor="seats">{t('estadio.seats', { cost: money(cost) })}</FieldLabel>
                <NumberInput
                  id="seats"
                  type="number"
                  min={FINANCE.MIN_EXPANSION}
                  max={FINANCE.MAX_EXPANSION}
                  step={500}
                  value={seats}
                  onChange={(event) => setSeats(Number(event.target.value))}
                />
              </Field>
              <Hint>{t('estadio.seatsHint')}</Hint>
              <ScreenActions className="estadio-screen__build">
                <Button
                  icon="build"
                  primary
                  type="button"
                  onClick={() => {
                    setBuilding(true)
                  }}
                >
                  {t('estadio.begin')}
                </Button>
                {building && (
                  <Confirm
                    title={t('confirm.expand.title')}
                    confirmLabel={t('estadio.begin')}
                    confirmIcon="build"
                    cancelLabel={t('action.cancel')}
                    onConfirm={() => {
                      setBuilding(false)
                      attempt(() => {
                        dispatch({ type: 'StartExpansion', seats })
                      })
                    }}
                    onCancel={() => {
                      setBuilding(false)
                    }}
                  >
                    <p>
                      {t('confirm.expand.body', {
                        cost: money(cost),
                        left: money(club.budget - cost),
                      })}
                    </p>
                    <p>{t('confirm.irreversible')}</p>
                  </Confirm>
                )}
              </ScreenActions>
            </div>
          )}
        </Screen>

        {error !== null && (
          <Screen className="estadio-screen__panel">
            <ScreenNote className="is-out" role="alert">
              {error}
            </ScreenNote>
          </Screen>
        )}
      </aside>
    </div>
  )
}
