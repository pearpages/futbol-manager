import { useState } from 'react'
import { isSeasonComplete, type MatchPlayed } from '@fm/domain'
import { Button, Icon } from '@fm/design-system'
import { useT } from '../i18n/useT.ts'
import { describeOpponent, matchdayFor } from '../matchday.ts'
import { useGame } from '../store.ts'
import { MatchResult } from './MatchResult.tsx'

/**
 * The next thing to do, on every screen, above the tabs.
 *
 * The same four states as the hub's controls and the desk footer's one,
 * merged: the sack, the season's end, a match due, or just the clock. On a
 * matchday the desk sends you back to the hub to kick off; here you play from
 * wherever you are — the lineup screen, usually, straight after picking the XI.
 */
export function PhoneAction(): React.JSX.Element | null {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const advanceToMatchday = useGame((s) => s.advanceToMatchday)
  const startNewSeason = useGame((s) => s.startNewSeason)
  const quitToLanding = useGame((s) => s.quitToLanding)
  const translator = useT()
  const { t, season } = translator
  const [result, setResult] = useState<MatchPlayed | null>(null)

  const matchday = matchdayFor(game)
  const you = game.managedClubId

  const play = () => {
    const events = dispatch({ type: 'AdvanceDay' })
    const mine = events.find(
      (e): e is MatchPlayed => e.type === 'MatchPlayed' && (e.homeId === you || e.awayId === you),
    )
    if (mine !== undefined) setResult(mine)
  }

  let action: React.JSX.Element | null
  if (game.board.sacked) {
    action = (
      <Button primary type="button" className="phone-action__main" onClick={quitToLanding}>
        {t('action.quit')}
      </Button>
    )
  } else if (isSeasonComplete(game)) {
    action = (
      <Button primary type="button" className="phone-action__main" onClick={startNewSeason}>
        {t('hub.startSeason', { season: season(game.season.startYear + 1) })}
      </Button>
    )
  } else if (matchday === null) {
    action = null
  } else if (matchday.due) {
    action = (
      <Button primary type="button" className="phone-action__main" onClick={play}>
        <Icon name="play" />
        {t('hub.playMatch', { opponent: describeOpponent(translator, matchday) })}
      </Button>
    )
  } else {
    action = (
      <>
        <Button
          primary
          type="button"
          className="phone-action__main"
          onClick={() => dispatch({ type: 'AdvanceDay' })}
        >
          {t('hub.advanceDay')}
        </Button>
        <Button
          type="button"
          className="phone-action__skip"
          aria-label={t('hub.toMatchday')}
          onClick={advanceToMatchday}
        >
          <Icon name="skip" />
        </Button>
      </>
    )
  }

  return (
    <>
      {action !== null && <div className="phone-action">{action}</div>}
      {result !== null && (
        <MatchResult
          event={result}
          onClose={() => {
            setResult(null)
          }}
        />
      )}
    </>
  )
}
