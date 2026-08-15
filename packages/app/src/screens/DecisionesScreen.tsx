import { computeTable, STRIKES_ALLOWED } from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import './DecisionesScreen.css'

/**
 * What the board wants, and how much patience is left.
 *
 * The board judges **league position and nothing else** — one number, one
 * verdict, so the season's story stays about football. Worth stating on the
 * screen rather than leaving a manager to infer it, because the natural
 * assumption is that the money matters too, and it does not.
 */

export function DecisionesScreen() {
  const game = useGame((s) => s.game)
  const go = useGame((s) => s.go)
  const { t } = useT()

  const club = game.clubs.find((c) => c.id === game.managedClubId)
  const table = computeTable(game.competition.clubIds, game.season.fixtures)
  const standing = table.findIndex((row) => row.clubId === game.managedClubId) + 1
  const played = game.season.fixtures.filter((f) => f.result !== null).length

  const { target, strikes } = game.board
  const onCourse = standing > 0 && standing <= target
  const left = STRIKES_ALLOWED - strikes

  return (
    <div className="decisiones-screen">
      <section className="screen decisiones-screen__main">
        <h2 className="screen__heading">{t('board.heading')}</h2>

        <div className="decisiones-screen__body">
          <p className="decisiones-screen__demand">
            {t('board.demand', {
              club: club?.name ?? t('board.fallbackName'),
              target,
            })}
          </p>

          <div className="decisiones-screen__stats">
            <div className="stat">
              <span className="stat__label">{t('board.target')}</span>
              <span className="stat__value">{target}</span>
            </div>
            <div className="stat">
              <span className="stat__label">{t('board.now')}</span>
              <span className={`stat__value${onCourse ? ' is-in' : ' is-out'}`}>
                {standing > 0 ? standing : t('squad.notSelected')}
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">{t('board.played')}</span>
              <span className="stat__value">{played / 10}</span>
            </div>
          </div>

          <p className={`decisiones-screen__verdict${onCourse ? ' is-in' : ' is-out'}`}>
            {t(played === 0 ? 'board.nothingPlayed' : onCourse ? 'board.onCourse' : 'board.below')}
          </p>
        </div>
      </section>

      <aside className="decisiones-screen__side">
        <section className="screen decisiones-screen__panel">
          <h2 className="screen__heading">{t('board.patience')}</h2>
          <div className="decisiones-screen__body">
            {/* Warnings shown as marks rather than a number, because "one strike"
                means nothing until you can see how many there are. */}
            <p className="decisiones-screen__strikes" aria-hidden="true">
              {Array.from({ length: STRIKES_ALLOWED }, (_, i) => (
                <span
                  key={i}
                  className={`decisiones-screen__strike${i < strikes ? ' is-spent' : ''}`}
                />
              ))}
            </p>
            <p className="screen__note">
              {strikes === 0
                ? t('board.clean', { strikes: STRIKES_ALLOWED })
                : t(left === 1 ? 'board.warned' : 'board.sacked')}
            </p>
          </div>
        </section>

        <section className="screen decisiones-screen__panel">
          <h2 className="screen__heading">{t('board.whatCounts')}</h2>
          <p className="screen__note">{t('board.whatCountsNote')}</p>
          <p className="screen__note">{t('board.targetNote')}</p>
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
