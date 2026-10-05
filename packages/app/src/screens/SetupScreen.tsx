import { useState } from 'react'
import type { Club } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { useT } from '../i18n/useT.ts'
import {
  Button,
  ClubCell,
  Confirm,
  DataTable,
  Screen,
  ScreenHeading,
  ScreenNote,
  type Sort,
  sortedBy,
  SortHeader,
} from '@fm/design-system'
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

/**
 * Keyed off the club's own rating — but the **thresholds** are a second, independent
 * reading of the spread and do not follow it automatically. When ratings became real
 * market values the old cuts (80/70/62/55) bucketed the division 2/2/4/11/1, putting
 * eleven clubs in one band and making the label useless exactly where a player most
 * needs it.
 *
 * These sit on the natural breaks in the real spread: three clubs clear at the top,
 * a European group, a short mid-table, then a long flat tail where seven clubs sit
 * inside two rating points — which is honest, because that is what the division is.
 *
 * **Re-check these whenever the rating mapping moves.** They are the one place a
 * compressed spread degrades silently rather than failing a test.
 */
// Dictionary keys. `TIERS` is module-level, so it cannot reach a hook — which is
// exactly why it holds keys and the component does the translating.
const TIERS: readonly Tier[] = [
  { label: 'tier.contender', note: 'tier.contender.note', min: 83 },
  { label: 'tier.european', note: 'tier.european.note', min: 77 },
  { label: 'tier.midTable', note: 'tier.midTable.note', min: 74 },
  { label: 'tier.struggler', note: 'tier.struggler.note', min: 71.5 },
  { label: 'tier.relegation', note: 'tier.relegation.note', min: 0 },
]

function tierFor(club: Club): Tier {
  const rating = (club.attack + club.defence) / 2
  /* c8 ignore next */
  return TIERS.find((t) => rating >= t.min) ?? TIERS[TIERS.length - 1]!
}

type SortKey = 'club' | 'attack' | 'defence' | 'prospects'

/** Text columns read left, numbers read right — the `data-table` convention. */
const SORT_ALIGN: Readonly<Record<SortKey, string>> = {
  club: 'is-text',
  attack: '',
  defence: '',
  prospects: 'is-text',
}

export function SetupScreen() {
  const newGame = useGame((s) => s.newGame)
  const storageBlocked = useGame((s) => s.storageBlocked)
  const { t, money, locale } = useT()

  /** `null` is the order `DEFAULT_CLUBS` is authored in — strongest first. */
  const [sort, setSort] = useState<Sort<SortKey> | null>(null)
  // A career is a season with one club: say what you are taking on first.
  const [choosing, setChoosing] = useState<Club | null>(null)

  // `sortedBy` copies, which matters here more than anywhere: `DEFAULT_CLUBS` is a
  // module constant shared with the rest of the app, and sorting it in place would
  // reorder the league for everyone.
  const clubs = sortedBy(
    DEFAULT_CLUBS,
    sort,
    (club, key) => {
      switch (key) {
        case 'club':
          return club.name
        case 'attack':
          return club.attack
        case 'defence':
          return club.defence
        case 'prospects':
          // What `tierFor` itself reads, so the tiers come out contiguous rather
          // than in the alphabetical order of their translated labels.
          return (club.attack + club.defence) / 2
      }
    },
    locale,
  )

  /** The shared header, bound to this screen's sort state. */
  function column(key: SortKey, label: string) {
    return (
      <SortHeader column={key} label={label} sort={sort} onSort={setSort} align={SORT_ALIGN[key]} />
    )
  }

  return (
    <div className="setup">
      <Screen className="setup__panel">
        <ScreenHeading>{t('setup.heading')}</ScreenHeading>
        {/* Landing here with a career already saved means storage could not be
            read, not that there is nothing to read. Without saying so, the club
            picker reads as "your career is gone". */}
        {storageBlocked ? (
          <ScreenNote className="is-out" role="alert">
            {t('setup.storageBlocked')}
          </ScreenNote>
        ) : (
          <ScreenNote>{t('setup.note')}</ScreenNote>
        )}

        <DataTable>
          <thead className="data-table__head">
            <tr>
              {column('club', t('setup.column.club'))}
              {column('attack', t('setup.column.attack'))}
              {column('defence', t('setup.column.defence'))}
              {column('prospects', t('setup.column.prospects'))}
              {/* A column of buttons — nothing to sort on. */}
              <th />
            </tr>
          </thead>
          <tbody>
            {clubs.map((club) => {
              const tier = tierFor(club)
              return (
                <tr key={club.id} className="data-table__row">
                  <td className="is-text setup__club">
                    <ClubCell>
                      <ClubBadge club={club} />
                      {club.name}
                    </ClubCell>
                  </td>
                  <td>{club.attack}</td>
                  <td>{club.defence}</td>
                  <td className="is-text setup__tier">
                    <strong>{t(tier.label)}</strong> <span>{t(tier.note)}</span>
                  </td>
                  <td>
                    <Button
                      icon="chevron"
                      primary
                      type="button"
                      onClick={() => {
                        setChoosing(club)
                      }}
                    >
                      {t('setup.takeCharge')}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      </Screen>

      {choosing !== null && (
        <Confirm
          title={choosing.name}
          confirmLabel={t('setup.takeCharge')}
          confirmIcon="play"
          cancelLabel={t('action.cancel')}
          onConfirm={() => {
            newGame(choosing.id)
          }}
          onCancel={() => {
            setChoosing(null)
          }}
        >
          <p>
            <strong>{t(tierFor(choosing).label)}</strong> {t(tierFor(choosing).note)}
          </p>
          <p>{t('confirm.club.budget', { budget: money(choosing.budget) })}</p>
        </Confirm>
      )}
    </div>
  )
}
