import { computeTable, STRIKES_ALLOWED } from '@fm/domain'
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

/** `12` → `12º`. Spanish, like the rest of the chrome. */
export function ordinal(position: number): string {
  return `${String(position)}º`
}

export function DecisionesScreen() {
  const game = useGame((s) => s.game)
  const go = useGame((s) => s.go)

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
        <h2 className="screen__heading">El objetivo</h2>

        <div className="decisiones-screen__body">
          <p className="decisiones-screen__demand">
            {club?.name ?? 'The board'} expect <strong>{ordinal(target)}</strong> or better.
          </p>

          <div className="decisiones-screen__stats">
            <div className="stat">
              <span className="stat__label">Objetivo</span>
              <span className="stat__value">{ordinal(target)}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Ahora</span>
              <span className={`stat__value${onCourse ? ' is-in' : ' is-out'}`}>
                {standing > 0 ? ordinal(standing) : '—'}
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Jugados</span>
              <span className="stat__value">{played / 10}</span>
            </div>
          </div>

          <p className={`decisiones-screen__verdict${onCourse ? ' is-in' : ' is-out'}`}>
            {played === 0
              ? 'Nothing has been played yet.'
              : onCourse
                ? 'On course. Keep it there.'
                : 'Below what was asked for.'}
          </p>
        </div>
      </section>

      <aside className="decisiones-screen__side">
        <section className="screen decisiones-screen__panel">
          <h2 className="screen__heading">Paciencia</h2>
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
                ? `Miss the target and the board will say so. Miss it ${String(STRIKES_ALLOWED)} seasons running and you are gone.`
                : left === 1
                  ? 'You have been warned once. Miss it again and the board will act.'
                  : 'The board have dismissed you.'}
            </p>
          </div>
        </section>

        <section className="screen decisiones-screen__panel">
          <h2 className="screen__heading">Lo que cuenta</h2>
          <p className="screen__note">
            Only where you finish. The board does not look at your balance, your overdraft or what
            you charge at the gate — those are yours to run.
          </p>
          <p className="screen__note">
            The target moves with you: finish well and more is asked next season, finish badly and
            less is. It is the warnings that end a job, not the arithmetic.
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
