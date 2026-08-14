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
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { positionChip } from './SquadScreen.tsx'
import './LineupScreen.css'

const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW']

export function LineupScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const go = useGame((s) => s.go)
  const { t } = useT()

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
        <h2 className="screen__heading">{t('lineup.startingXI')}</h2>
        {POSITIONS.map((position) => {
          const inXI = squad.filter((p) => p.position === position && starters.has(p.id))
          const bench = squad.filter((p) => p.position === position && !starters.has(p.id))

          return (
            <div key={position} className="lineup-group">
              <h3 className="lineup-group__title">
                {positionChip(position, t(`position.${position}`))}{' '}
                <span>{t('lineup.needed', { count: shape[position] })}</span>
              </h3>
              {inXI.map((player: Player) => (
                <div key={player.id} className="lineup-row">
                  <span className="lineup-row__name">{player.name}</span>
                  <span className="lineup-row__ovr">{overall(player)}</span>
                  <label className="lineup-row__swap">
                    <span className="lineup-row__swap-label">{t('lineup.replaceWith')}</span>
                    <select
                      className="lineup-row__select"
                      value=""
                      onChange={(event) => {
                        if (event.target.value !== '')
                          swap(player.id, event.target.value as PlayerId)
                      }}
                    >
                      <option value="">{t('lineup.keep')}</option>
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
          <h2 className="screen__heading">{t('lineup.shape')}</h2>
          <div className="lineup-screen__body">
            <div className="field">
              <span className="field__label">{t('lineup.formation')}</span>
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
              <p className="lineup-screen__hint">{t('lineup.formationHint')}</p>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="attacking">
                {t('lineup.approach', { approach: t(describeApproach(tactics.attacking)) })}
              </label>
              <input
                id="attacking"
                className="slider"
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
              <p className="lineup-screen__hint">{t('lineup.approachHint')}</p>
            </div>
          </div>
        </section>

        <section className="screen lineup-screen__panel">
          <h2 className="screen__heading">{t('lineup.thisXI')}</h2>
          <div className="lineup-screen__ratings">
            <div className="stat">
              <span className="stat__label">{t('lineup.attack')}</span>
              <span className="stat__value">{rating.attack}</span>
            </div>
            <div className="stat">
              <span className="stat__label">{t('lineup.defence')}</span>
              <span className="stat__value">{rating.defence}</span>
            </div>
          </div>
          <p className="lineup-screen__hint lineup-screen__hint--pad">{t('lineup.ratingHint')}</p>
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

/** Returns a dictionary key, not a word — the caller translates it. */
function describeApproach(attacking: number): string {
  if (attacking >= 85) return 'approach.allOut'
  if (attacking >= 65) return 'approach.attacking'
  if (attacking > 35) return 'approach.balanced'
  if (attacking > 15) return 'approach.defensive'
  return 'approach.parkTheBus'
}
