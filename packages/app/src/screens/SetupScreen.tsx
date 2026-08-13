import type { Club } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { useGame } from '../store.ts'
import './SetupScreen.css'

/**
 * Pick a club. Shown when there is no save to restore.
 *
 * Until M3c every career started at Almería, because `newSeason` defaulted to the
 * last-rated club — a default nobody chose, and the club with the least to play
 * for. The choice is worth making informed: the measured spread across a season
 * is roughly 85 points at the top and 30 at the bottom.
 */

interface Tier {
  readonly label: string
  readonly note: string
  readonly min: number
}

/** Keyed off the club's own rating, so it stays honest if the ratings change. */
const TIERS: readonly Tier[] = [
  { label: 'Contender', note: 'Expected to win it. Anything less is a failure.', min: 80 },
  { label: 'European', note: 'Should finish top six. A title needs luck.', min: 70 },
  { label: 'Mid-table', note: 'Safe most years. Europe is a good season.', min: 62 },
  { label: 'Struggler', note: 'Survival is the job.', min: 55 },
  { label: 'Relegation favourite', note: 'Staying up would be an achievement.', min: 0 },
]

function tierFor(club: Club): Tier {
  const rating = (club.attack + club.defence) / 2
  /* c8 ignore next */
  return TIERS.find((t) => rating >= t.min) ?? TIERS[TIERS.length - 1]!
}

export function SetupScreen() {
  const newGame = useGame((s) => s.newGame)

  return (
    <div className="setup">
      <section className="screen setup__panel">
        <h2 className="screen__heading">Choose a club</h2>
        <p className="screen__note">
          You manage one club for the season. The rest are run by the game.
        </p>

        <table className="data-table">
          <thead className="data-table__head">
            <tr>
              <th className="is-text">Club</th>
              <th>Att</th>
              <th>Def</th>
              <th className="is-text">Prospects</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {DEFAULT_CLUBS.map((club) => {
              const tier = tierFor(club)
              return (
                <tr key={club.id} className="data-table__row">
                  <td className="is-text setup__club">{club.name}</td>
                  <td>{club.attack}</td>
                  <td>{club.defence}</td>
                  <td className="is-text setup__tier">
                    <strong>{tier.label}</strong> <span>{tier.note}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button is-primary"
                      onClick={() => newGame(club.id)}
                    >
                      Take charge
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
