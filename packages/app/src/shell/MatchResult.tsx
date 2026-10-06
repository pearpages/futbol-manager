import { useMemo } from 'react'
import { computeTable, type MatchPlayed } from '@fm/domain'
import { Button, Modal, ScreenActions, VisuallyHidden } from '@fm/design-system'
import { bandFor } from '../bands.ts'
import { useT } from '../i18n/useT.ts'
import { describe, lookupFor } from '../notifications.ts'
import { ClubBadge } from '../screens/ClubBadge.tsx'
import { useGame } from '../store.ts'
import './MatchResult.css'

/**
 * The match you just played, as a moment rather than a line of news.
 *
 * Kicking off is the one press the whole loop builds towards, and on the desk
 * its answer arrives as a sentence in a list. Here it gets the score, both
 * crests, the sentence the news will keep, and where it leaves you.
 */
export function MatchResult({
  event,
  onClose,
}: {
  readonly event: MatchPlayed
  readonly onClose: () => void
}): React.JSX.Element {
  const game = useGame((s) => s.game)
  const translator = useT()
  const { t } = translator

  const home = game.clubs.find((c) => c.id === event.homeId)
  const away = game.clubs.find((c) => c.id === event.awayId)
  const notice = describe(event, game, lookupFor(game, translator), translator)

  const standing = useMemo(() => {
    const table = computeTable(game.competition.clubIds, game.season.fixtures)
    return {
      position: table.findIndex((row) => row.clubId === game.managedClubId) + 1,
      total: table.length,
    }
  }, [game])
  const band = bandFor(standing.position, standing.total)

  return (
    <Modal title={t('result.title')} onClose={onClose}>
      <p className="match-result__score" aria-hidden="true">
        <span className="match-result__side">
          {home !== undefined && <ClubBadge club={home} size="lg" />}
          {home?.shortName}
        </span>
        <span className="match-result__goals">
          {event.score.home}–{event.score.away}
        </span>
        <span className="match-result__side">
          {away !== undefined && <ClubBadge club={away} size="lg" />}
          {away?.shortName}
        </span>
      </p>
      {/* The picture above is hidden from screen readers because the news line
          says the same; when there is no line, the score is said here instead. */}
      {notice !== null ? (
        <p className={`match-result__line is-${notice.tone}`}>{notice.text}</p>
      ) : (
        <VisuallyHidden>
          {t('result.scoreLine', {
            home: home?.name ?? '',
            homeGoals: event.score.home,
            away: away?.name ?? '',
            awayGoals: event.score.away,
          })}
        </VisuallyHidden>
      )}
      <p className={`match-result__position ${band?.className ?? ''}`}>
        {t('result.position', { position: standing.position })}
      </p>
      <ScreenActions>
        <Button icon="play" primary type="button" onClick={onClose}>
          {t('result.continue')}
        </Button>
      </ScreenActions>
    </Modal>
  )
}
