import { ageOn, ATTRIBUTE_KEYS, overall, playerAttack, playerDefence } from '@fm/domain'
import { useGame } from '../store.ts'
import { positionChip } from './SquadScreen.tsx'
import './PlayerScreen.css'

/**
 * The ficha — the player card this genre is built around.
 *
 * Eight bars, because there are eight attributes and a manager reads them as a
 * shape rather than a list of numbers. Colour marks only the extremes: a bar is
 * neutral unless the value is worth noticing.
 */
function band(value: number): string {
  if (value >= 80) return ' is-strong'
  if (value <= 40) return ' is-weak'
  return ''
}

export function PlayerScreen() {
  const game = useGame((s) => s.game)
  const playerId = useGame((s) => s.inspectedPlayerId)
  const inspect = useGame((s) => s.inspect)

  const squad = game.squads[game.managedClubId] ?? []
  // The ficha reads anyone in the game, not only your own players — the market
  // screen opens it for a target you are thinking about bidding for, and a card
  // that only worked for players you already own would be useless there.
  const player =
    squad.find((p) => p.id === playerId) ??
    game.clubs.flatMap((c) => game.squads[c.id] ?? []).find((p) => p.id === playerId) ??
    game.freeAgents.find((p) => p.id === playerId)

  if (player === undefined) {
    return (
      <section className="screen">
        <h2 className="screen__heading">No player selected</h2>
        <p className="screen__note">Pick someone from the squad list.</p>
      </section>
    )
  }

  const lineup = game.lineups[game.managedClubId]
  const isStarting = lineup?.starters.includes(player.id) ?? false

  return (
    <section className="screen ficha">
      <header className="ficha__head">
        <div className="ficha__identity">
          {positionChip(player.position)}
          <h2 className="ficha__name">{player.name}</h2>
        </div>
        {/* Contextual, not a route home: a ficha opened from a two-hundred-row
            market list returns to that list, never to the hub. */}
        <button className="button" type="button" onClick={() => inspect(null)}>
          Volver
        </button>
      </header>

      <div className="ficha__body">
        <dl className="ficha__vitals">
          <div className="stat">
            <dt className="stat__label">Overall</dt>
            <dd className="stat__value">{overall(player)}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Age</dt>
            <dd className="stat__value">{ageOn(player, game.season.currentDate)}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Attack</dt>
            <dd className="stat__value">{Math.round(playerAttack(player))}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Defence</dt>
            <dd className="stat__value">{Math.round(playerDefence(player))}</dd>
          </div>
        </dl>

        <div className="ficha__attributes">
          {ATTRIBUTE_KEYS.map((key) => {
            const value = player.attributes[key]
            return (
              <div key={key} className="attr">
                <span className="attr__label">{key}</span>
                <span className="attr__track">
                  {/* Width comes from a bucketed data attribute rather than an
                      inline style: the convention keeps every styling decision in
                      CSS, and 5% steps are visually indistinguishable from exact. */}
                  <span className={`attr__fill${band(value)}`} data-fill={Math.round(value / 5)} />
                </span>
                <span className="attr__value">{value}</span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="ficha__status">
        {isStarting ? 'In the starting XI.' : 'On the bench. Change the lineup to start them.'}
      </p>
    </section>
  )
}
