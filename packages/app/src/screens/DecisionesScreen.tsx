import { computeTable, STRIKES_ALLOWED } from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { Screen, ScreenHeading, ScreenNote, Stat, StatLabel, StatValue } from '@fm/design-system'
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
  const { t, club: clubPhrase } = useT()

  const club = game.clubs.find((c) => c.id === game.managedClubId)
  const table = computeTable(game.competition.clubIds, game.season.fixtures)
  const standing = table.findIndex((row) => row.clubId === game.managedClubId) + 1
  const played = game.season.fixtures.filter((f) => f.result !== null).length

  const { target, strikes } = game.board
  const onCourse = standing > 0 && standing <= target
  const left = STRIKES_ALLOWED - strikes

  return (
    <div className="decisiones-screen">
      <Screen className="decisiones-screen__main">
        <ScreenHeading>{t('board.heading')}</ScreenHeading>

        <div className="decisiones-screen__body">
          <p className="decisiones-screen__demand">
            {t('board.demand', {
              // The fallback brings its own article, so it must not go through
              // `clubPhrase` — `El {club}` in the sentence used to make this
              // read "El La junta espera".
              club:
                club === undefined
                  ? t('board.fallbackName')
                  : clubPhrase(club.name, { caps: true }),
              target,
            })}
          </p>

          <div className="decisiones-screen__stats">
            <Stat>
              <StatLabel>{t('board.target')}</StatLabel>
              <StatValue>{target}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('board.now')}</StatLabel>
              <StatValue className={`${onCourse ? ' is-in' : ' is-out'}`}>
                {standing > 0 ? standing : t('squad.notSelected')}
              </StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('board.played')}</StatLabel>
              <StatValue>{played / 10}</StatValue>
            </Stat>
          </div>

          <p className={`decisiones-screen__verdict${onCourse ? ' is-in' : ' is-out'}`}>
            {t(played === 0 ? 'board.nothingPlayed' : onCourse ? 'board.onCourse' : 'board.below')}
          </p>
        </div>
      </Screen>

      <aside className="decisiones-screen__side">
        <Screen className="decisiones-screen__panel">
          <ScreenHeading>{t('board.patience')}</ScreenHeading>
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
            <ScreenNote>
              {strikes === 0
                ? t('board.clean', { strikes: STRIKES_ALLOWED })
                : t(left === 1 ? 'board.warned' : 'board.sacked')}
            </ScreenNote>
          </div>
        </Screen>

        <Screen className="decisiones-screen__panel">
          <ScreenHeading>{t('board.whatCounts')}</ScreenHeading>
          <ScreenNote>{t('board.whatCountsNote')}</ScreenNote>
          <ScreenNote>{t('board.targetNote')}</ScreenNote>
        </Screen>
      </aside>
    </div>
  )
}
