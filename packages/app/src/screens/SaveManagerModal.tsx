import { useEffect, useMemo, useState } from 'react'
import { nameFor, type SaveSummary } from '@fm/persistence'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { Modal } from '@fm/design-system'
import './SaveManagerModal.css'

/**
 * Name a save, pick one back up, throw one away.
 *
 * Until this there was exactly one slot, silently overwritten by Grabar and read
 * back on load — so a career could be advanced but never revisited. The one thing
 * a save has to say before you open it is *which* career and *when*: the club, the
 * date and the jornada, which is what the description line is.
 *
 * A dialog rather than a screen because it belongs over what you were doing. It
 * also has no business in the hub's four quadrants — none of them is "the game
 * itself", which is what saving is about.
 */

/** A step that cannot be undone, held until it is confirmed in the same box. */
interface Pending {
  readonly kind: 'overwrite' | 'load' | 'delete'
  readonly slot: string
  readonly name: string
}

interface SaveManagerModalProps {
  readonly onClose: () => void
}

export function SaveManagerModal({ onClose }: SaveManagerModalProps): React.JSX.Element {
  const { t, date, locale } = useT()
  const saves = useGame((s) => s.saves)
  const currentSlot = useGame((s) => s.currentSlot)
  const saving = useGame((s) => s.saving)
  const saveAs = useGame((s) => s.saveAs)
  const load = useGame((s) => s.load)
  const remove = useGame((s) => s.remove)
  const refreshSaves = useGame((s) => s.refreshSaves)

  // Prefilled with the save this career is already in, because that is what the
  // press almost always means: Desar → Desar → done, with the overwrite confirm
  // as the only extra step. An empty field would make saving over your own game
  // an act of retyping its name exactly.
  const [name, setName] = useState(() => (currentSlot === null ? '' : (nameFor(currentSlot) ?? '')))
  const [pending, setPending] = useState<Pending | null>(null)

  // The list can be stale — another tab, or a save deleted since this session
  // started. Opening the picker is the moment to find out.
  useEffect(() => {
    void refreshSaves()
  }, [refreshSaves])

  // `listSaves` already orders by in-game date. The tiebreak has to live here
  // because a locale decides it, and ties are the *normal* case: two careers
  // started separately both open on 15 August.
  const ordered = useMemo(
    () =>
      [...saves].sort(
        (a, b) => b.currentDate - a.currentDate || a.name.localeCompare(b.name, locale),
      ),
    [saves, locale],
  )

  const typed = name.trim()

  /** What the picker says about a save without opening it. One whole sentence. */
  const describe = (save: SaveSummary): string =>
    save.round === null
      ? t('saves.summaryOver', { date: date(save.currentDate), club: save.clubName })
      : t('saves.summary', {
          date: date(save.currentDate),
          club: save.clubName,
          round: save.round,
        })

  const confirm = async () => {
    if (pending === null) return
    setPending(null)
    if (pending.kind === 'overwrite') {
      // The field keeps the name rather than clearing: that save is now the one
      // this career is in, so emptying it would contradict what reopening the
      // dialog shows a moment later.
      await saveAs(pending.name)
      return
    }
    if (pending.kind === 'delete') {
      await remove(pending.slot)
      return
    }
    if (await load(pending.slot)) onClose()
  }

  const question =
    pending === null
      ? ''
      : t(
          pending.kind === 'overwrite'
            ? 'saves.confirmOverwrite'
            : pending.kind === 'delete'
              ? 'saves.confirmDelete'
              : 'saves.confirmLoad',
          { name: pending.name },
        )

  const proceed =
    pending === null
      ? ''
      : t(
          pending.kind === 'overwrite'
            ? 'saves.write'
            : pending.kind === 'delete'
              ? 'saves.delete'
              : 'saves.load',
        )

  // The confirmation replaces the body rather than opening a second dialog. Two
  // stacked overlays is a shape this app has no answer for, and the question is
  // about the thing the list was showing anyway.
  if (pending !== null) {
    return (
      <Modal title={t('saves.title')} onClose={onClose}>
        <p className="save-manager__question" role="alert">
          {question}
        </p>
        <div className="screen-actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              setPending(null)
            }}
          >
            {t('action.cancel')}
          </button>
          <button
            type="button"
            className="button is-primary"
            disabled={saving}
            onClick={() => void confirm()}
          >
            {proceed}
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={t('saves.title')} onClose={onClose} wide>
      <div className="field save-manager__name">
        <label className="field__label" htmlFor="save-name">
          {t('saves.nameLabel')}
        </label>
        <div className="save-manager__row">
          <input
            id="save-name"
            className="number-input save-manager__input"
            type="text"
            value={name}
            maxLength={40}
            onChange={(event) => {
              setName(event.target.value)
            }}
          />
          <button
            type="button"
            className="button is-primary"
            // An empty name has nowhere to go, and the field being empty says so
            // more plainly than a refusal would.
            disabled={saving || typed === ''}
            onClick={() => {
              const slot = saves.find((save) => save.name === typed)?.slot
              if (slot !== undefined) {
                setPending({ kind: 'overwrite', slot, name: typed })
                return
              }
              // The field keeps what was typed: the new save is now the one this
              // career is in, and clearing it would disagree with the prefill the
              // next open shows.
              void saveAs(typed)
            }}
          >
            {saving ? t('action.saving') : t('saves.write')}
          </button>
        </div>
      </div>

      <div className="screen save-manager__list">
        {ordered.length === 0 ? (
          <p className="screen__note">{t('saves.empty')}</p>
        ) : (
          <table className="data-table">
            <thead className="data-table__head">
              <tr>
                <th className="is-text">{t('saves.column.name')}</th>
                <th className="is-text">{t('saves.column.career')}</th>
                <th>{t('saves.column.action')}</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((save) => (
                <tr
                  key={save.slot}
                  className={`data-table__row${save.slot === currentSlot ? ' is-you' : ''}`}
                >
                  <td className="is-text save-manager__slot">
                    {save.name}
                    {save.slot === currentSlot && (
                      // The leading space is load-bearing and invisible: a flex
                      // item's leading whitespace is trimmed on screen, but the
                      // cell's text is what assistive technology reads, and
                      // without it this announces as "Temporada 1En joc". The
                      // same defect the hub's milestone badge has ("CanteraM7").
                      <span className="save-manager__badge"> {t('saves.current')}</span>
                    )}
                  </td>
                  <td className="is-text save-manager__career">{describe(save)}</td>
                  <td className="save-manager__actions">
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        setPending({ kind: 'load', slot: save.slot, name: save.name })
                      }}
                    >
                      {t('saves.load')}
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        setPending({ kind: 'delete', slot: save.slot, name: save.name })
                      }}
                    >
                      {t('saves.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="screen-actions">
        <button type="button" className="button" onClick={onClose}>
          {t('action.close')}
        </button>
      </div>
    </Modal>
  )
}
