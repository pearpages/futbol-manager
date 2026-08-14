import type { Club } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
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
// Dictionary keys. `TIERS` is module-level, so it cannot reach a hook — which is
// exactly why it holds keys and the component does the translating.
const TIERS: readonly Tier[] = [
  { label: 'tier.contender', note: 'tier.contender.note', min: 80 },
  { label: 'tier.european', note: 'tier.european.note', min: 70 },
  { label: 'tier.midTable', note: 'tier.midTable.note', min: 62 },
  { label: 'tier.struggler', note: 'tier.struggler.note', min: 55 },
  { label: 'tier.relegation', note: 'tier.relegation.note', min: 0 },
]

function tierFor(club: Club): Tier {
  const rating = (club.attack + club.defence) / 2
  /* c8 ignore next */
  return TIERS.find((t) => rating >= t.min) ?? TIERS[TIERS.length - 1]!
}

export function SetupScreen() {
  const newGame = useGame((s) => s.newGame)
  const { t } = useT()

  return (
    <div className="setup">
      <section className="screen setup__panel">
        <h2 className="screen__heading">{t('setup.heading')}</h2>
        <p className="screen__note">{t('setup.note')}</p>

        <table className="data-table">
          <thead className="data-table__head">
            <tr>
              <th className="is-text">{t('setup.column.club')}</th>
              <th>{t('setup.column.attack')}</th>
              <th>{t('setup.column.defence')}</th>
              <th className="is-text">{t('setup.column.prospects')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {DEFAULT_CLUBS.map((club) => {
              const tier = tierFor(club)
              return (
                <tr key={club.id} className="data-table__row">
                  <td className="is-text setup__club">
                    <span className="club-cell">
                      <ClubBadge club={club} />
                      {club.name}
                    </span>
                  </td>
                  <td>{club.attack}</td>
                  <td>{club.defence}</td>
                  <td className="is-text setup__tier">
                    <strong>{t(tier.label)}</strong> <span>{t(tier.note)}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button is-primary"
                      onClick={() => newGame(club.id)}
                    >
                      {t('setup.takeCharge')}
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
