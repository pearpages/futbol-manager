import {
  bestXI,
  canField,
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
import { PlayerLink } from './PlayerLink.tsx'
import { positionChip } from './SquadScreen.tsx'
import './LineupScreen.css'

const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW']

export function LineupScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
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
                  <PlayerLink player={player} className="lineup-row__name" />
                  <span className="lineup-row__ovr">{overall(player)}</span>
                  <label className="lineup-row__swap">
                    <span className="lineup-row__swap-label">{t('lineup.replaceWith')}</span>
                    <select
                      className="select lineup-row__select"
                      value=""
                      onChange={(event) => {
                        if (event.target.value !== '')
                          swap(player.id, event.target.value as PlayerId)
                      }}
                    >
                      <option value="">{t('lineup.keep')}</option>
                      {/* The one place a player's name is not a way into his
                          ficha: an `<option>` cannot hold a button. Everyone on
                          this list is a row on Plantilla, so the gap costs a
                          detour rather than a dead end. */}
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
                {FORMATION_NAMES.map((formation) => {
                  // `bestXI` throws on a squad short at any bank, and `setFormation`
                  // calls it before dispatching — so an enabled button here is an
                  // uncaught throw in an event handler, with no error boundary.
                  const playable = canField(squad, formation)
                  return (
                    <button
                      key={formation}
                      type="button"
                      className={`button${formation === lineup.formation ? ' is-primary' : ''}`}
                      disabled={!playable}
                      {...(playable ? {} : { title: t('lineup.cannotField') })}
                      onClick={() => setFormation(formation)}
                    >
                      {formation}
                    </button>
                  )
                })}
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
            <div className="stat">
              <span className="stat__label">{t('lineup.tempo')}</span>
              <span className="stat__value lineup-screen__word">
                {t(describeTempo(rating.tempo))}
              </span>
            </div>
          </div>
          <p className="lineup-screen__hint lineup-screen__hint--pad">{t('lineup.ratingHint')}</p>
        </section>
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

/**
 * How open the game is, as a word — the third number the resolver reads and the
 * only one with no control of its own.
 *
 * `tempo` is set by the slider *and* the formation together, which is exactly why
 * it needs saying out loud: neither control announces that it is also doing this.
 *
 * **The cuts are against the values that actually occur**, not rounded for looks.
 * The slider contributes −1…+1 and `FORMATION_TEMPO` −0.7…+0.4, so at the default
 * slider 4-2-4 reads Open, 5-4-1 and 4-5-1 read Tight, and the milder shapes stay
 * Balanced rather than overclaiming. Retune `FORMATION_TEMPO` and re-check that.
 *
 * Three bands where the approach slider has five: openness is a coarser thing than
 * mentality, and five words would imply a precision the model does not have.
 */
function describeTempo(tempo: number): string {
  if (tempo >= 0.35) return 'tempo.open'
  if (tempo > -0.35) return 'tempo.balanced'
  return 'tempo.tight'
}
