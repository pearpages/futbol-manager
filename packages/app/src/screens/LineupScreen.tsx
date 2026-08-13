import {
  bestXI,
  FORMATION_NAMES,
  FORMATIONS,
  type Formation,
  overall,
  type Player,
  type PlayerId,
  type Position,
  startersOf,
  teamRating,
} from '@fm/domain'
import { useGame } from '../store.ts'
import { positionChip } from './SquadScreen.tsx'
import './LineupScreen.css'

const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW']

export function LineupScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)

  const clubId = game.managedClubId
  const squad = game.squads[clubId] ?? []
  const lineup = game.lineups[clubId]
  const tactics = game.tactics[clubId] ?? { attacking: 50 }
  if (lineup === undefined) return null

  const starters = new Set<PlayerId>(lineup.starters)
  const shape = FORMATIONS[lineup.formation]
  const rating = teamRating(startersOf(squad, lineup), tactics)

  /** Swaps one starter for one substitute of the same position, keeping the XI legal. */
  const swap = (out: PlayerId, incoming: PlayerId) => {
    dispatch({
      type: 'SetLineup',
      clubId,
      lineup: { ...lineup, starters: lineup.starters.map((id) => (id === out ? incoming : id)) },
    })
  }

  const setFormation = (formation: Formation) => {
    dispatch({ type: 'SetLineup', clubId, lineup: bestXI(squad, formation) })
  }

  return (
    <div className="lineup-screen">
      <section className="screen lineup-screen__xi">
        <h2 className="screen__heading">Starting XI</h2>
        {POSITIONS.map((position) => {
          const inXI = squad.filter((p) => p.position === position && starters.has(p.id))
          const bench = squad.filter((p) => p.position === position && !starters.has(p.id))

          return (
            <div key={position} className="lineup-group">
              <h3 className="lineup-group__title">
                {positionChip(position)} <span>{shape[position]} needed</span>
              </h3>
              {inXI.map((player: Player) => (
                <div key={player.id} className="lineup-row">
                  <span className="lineup-row__name">{player.name}</span>
                  <span className="lineup-row__ovr">{overall(player)}</span>
                  <label className="lineup-row__swap">
                    <span className="lineup-row__swap-label">Replace with</span>
                    <select
                      className="lineup-row__select"
                      value=""
                      onChange={(event) => {
                        if (event.target.value !== '')
                          swap(player.id, event.target.value as PlayerId)
                      }}
                    >
                      <option value="">Keep</option>
                      {bench.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} ({overall(sub)})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )
        })}
      </section>

      <aside className="lineup-screen__controls">
        <section className="screen lineup-screen__panel">
          <h2 className="screen__heading">Shape</h2>
          <div className="lineup-screen__body">
            <div className="field">
              <span className="field__label">Formation</span>
              <div className="lineup-screen__formations">
                {FORMATION_NAMES.map((formation) => (
                  <button
                    key={formation}
                    type="button"
                    className={`button${formation === lineup.formation ? ' is-primary' : ''}`}
                    onClick={() => setFormation(formation)}
                  >
                    {formation}
                  </button>
                ))}
              </div>
              <p className="lineup-screen__hint">Changing shape picks the best XI for it.</p>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="attacking">
                Approach · {describeApproach(tactics.attacking)}
              </label>
              <input
                id="attacking"
                className="lineup-screen__slider"
                type="range"
                min={0}
                max={100}
                step={5}
                value={tactics.attacking}
                onChange={(event) =>
                  dispatch({
                    type: 'SetTactics',
                    clubId,
                    tactics: { attacking: Number(event.target.value) },
                  })
                }
              />
              <p className="lineup-screen__hint">
                Pushing either way costs more than it gives. Attack suits a strong side; a weaker
                one is punished for it.
              </p>
            </div>
          </div>
        </section>

        <section className="screen lineup-screen__panel">
          <h2 className="screen__heading">This XI</h2>
          <div className="lineup-screen__ratings">
            <div className="stat">
              <span className="stat__label">Attack</span>
              <span className="stat__value">{rating.attack}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Defence</span>
              <span className="stat__value">{rating.defence}</span>
            </div>
          </div>
          <p className="lineup-screen__hint lineup-screen__hint--pad">
            These two numbers are all the match resolver sees.
          </p>
        </section>
      </aside>
    </div>
  )
}

function describeApproach(attacking: number): string {
  if (attacking >= 85) return 'All-out attack'
  if (attacking >= 65) return 'Attacking'
  if (attacking > 35) return 'Balanced'
  if (attacking > 15) return 'Defensive'
  return 'Park the bus'
}
