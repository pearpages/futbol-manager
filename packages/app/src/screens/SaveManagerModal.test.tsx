import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { createRng, nextFixtureFor } from '@fm/domain'
import { AUTOSAVE_SLOT, loadGame, saveGame, slotFor } from '@fm/persistence'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { advance } from '../testing.ts'

/**
 * Naming a save, picking one back up, and throwing one away.
 *
 * Driven through `<App />` against a real IndexedDB, the way every screen test is
 * driven against the real reducer — the whole point of this feature is the round
 * trip, and a test that stubbed storage would prove nothing about it.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

const { t, date } = translatorFor('en')
const game = () => useGame.getState().game

beforeEach(() => {
  useGame.getState().newGame(MID)
})

/**
 * Opens the dialog from the hub and waits for the list to come back from storage.
 *
 * Through `action.save` — the hub's Save button *is* the way in. It used to be a
 * silent quick-save with a second button for naming, which is how the first
 * person to use this could neither name a game nor find one.
 */
async function openPicker(): Promise<HTMLElement> {
  // The button carries the `saving` label, so a press issued while a write is
  // still settling looks for a name that is not on screen yet.
  await settled()
  fireEvent.click(screen.getByRole('button', { name: t('action.save') }))
  const dialog = screen.getByRole('dialog')
  await settled()
  return dialog
}

/**
 * Waits for the store to be idle, not merely for the list to have arrived.
 *
 * `saveAs` refreshes the list inside its `try` and clears `saving` in the
 * `finally`, so waiting on `saves` returns a tick early — long enough, under a
 * loaded machine, for the next press to find the button still reading "Saving…".
 * That flaked exactly once in a full run and passed every time in isolation.
 */
async function settled(): Promise<void> {
  await waitFor(() => {
    expect(useGame.getState().saving).toBe(false)
  })
}

async function saveAs(name: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(t('saves.nameLabel')), { target: { value: name } })
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: t('action.save') }),
  )
  await waitFor(() => {
    expect(useGame.getState().saves.some((save) => save.name === name)).toBe(true)
  })
  await settled()
}

const rows = () => within(screen.getByRole('dialog')).queryAllByRole('row').slice(1)

describe('the save picker', () => {
  it('says so when nothing has been saved', async () => {
    render(<App />)
    const dialog = await openPicker()

    expect(within(dialog).getByText(t('saves.empty'))).toBeDefined()
  })

  it('lists a save under the name you gave it, with the club, the date and the jornada', async () => {
    render(<App />)

    // Several rounds in, deliberately. A fresh career sits on matchday 1, so a
    // description that hardcoded the round would pass on a brand new save and be
    // wrong for every other one — which is exactly what the first version of this
    // test failed to catch.
    await act(async () => {
      advance(20)
    })
    const round = nextFixtureFor(game().season.fixtures, game().managedClubId)?.round
    expect(round).toBeGreaterThan(1)

    await openPicker()
    await saveAs('Temporada 1')

    const club = game().clubs.find((c) => c.id === game().managedClubId)?.name
    const row = rows()[0] as HTMLElement

    expect(within(row).getByText('Temporada 1')).toBeDefined()
    expect(
      within(row).getByText(
        t('saves.summary', {
          date: date(game().season.currentDate),
          club: club ?? '',
          round: round ?? 0,
        }),
      ),
    ).toBeDefined()
  })

  it('refuses to save until the field says something', async () => {
    render(<App />)
    const dialog = await openPicker()
    const save = within(dialog).getByRole('button', { name: t('action.save') })

    expect((save as HTMLButtonElement).disabled).toBe(true)
    // Whitespace is not a name — trimming happens before the check, not after.
    fireEvent.change(screen.getByLabelText(t('saves.nameLabel')), { target: { value: '   ' } })
    expect((save as HTMLButtonElement).disabled).toBe(true)
  })

  it('takes you back to where a save was made', async () => {
    render(<App />)
    await openPicker()
    await saveAs('August')
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('action.close') }),
    )

    const savedDate = game().season.currentDate
    await act(async () => {
      advance(3)
    })
    expect(game().season.currentDate).toBeGreaterThan(savedDate)

    await openPicker()
    fireEvent.click(within(rows()[0] as HTMLElement).getByRole('button', { name: t('saves.load') }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('saves.load') }),
    )

    await waitFor(() => {
      expect(game().season.currentDate).toBe(savedDate)
    })
    // Loading a career is a whole new state, so the picker has done its job.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks before writing over a name that is taken, and keeps only one row', async () => {
    render(<App />)
    await openPicker()
    await saveAs('Same name')
    const first = game().season.currentDate

    await act(async () => {
      advance(3)
    })

    fireEvent.change(screen.getByLabelText(t('saves.nameLabel')), {
      target: { value: 'Same name' },
    })
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('action.save') }),
    )
    expect(screen.getByText(t('saves.confirmOverwrite', { name: 'Same name' }))).toBeDefined()

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('action.save') }),
    )
    await waitFor(() => {
      expect(useGame.getState().saves[0]?.currentDate).toBeGreaterThan(first)
    })
    expect(useGame.getState().saves).toHaveLength(1)
  })

  it('asks before deleting, and the save is gone once it is answered', async () => {
    render(<App />)
    await openPicker()
    await saveAs('Doomed')

    fireEvent.click(
      within(rows()[0] as HTMLElement).getByRole('button', { name: t('saves.delete') }),
    )
    expect(screen.getByText(t('saves.confirmDelete', { name: 'Doomed' }))).toBeDefined()

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('saves.delete') }),
    )
    await waitFor(() => {
      expect(useGame.getState().saves).toHaveLength(0)
    })
    expect(within(screen.getByRole('dialog')).getByText(t('saves.empty'))).toBeDefined()
  })

  it('leaves the save alone when a confirmation is declined', async () => {
    render(<App />)
    await openPicker()
    await saveAs('Kept')

    fireEvent.click(
      within(rows()[0] as HTMLElement).getByRole('button', { name: t('saves.delete') }),
    )
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('action.cancel') }),
    )

    expect(useGame.getState().saves).toHaveLength(1)
    expect(within(rows()[0] as HTMLElement).getByText('Kept')).toBeDefined()
  })

  it('orders the newest career first', async () => {
    render(<App />)
    await openPicker()
    await saveAs('Older')
    await act(async () => {
      advance(5)
    })
    await saveAs('Newer')

    expect(rows().map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      // The space before the badge is deliberate — it is what stops this reading
      // as "NewerEn joc" to anything that hears the cell rather than seeing it.
      `Newer ${t('saves.current')}`,
      'Older',
    ])
  })

  it('marks which save you are actually playing', async () => {
    render(<App />)
    await openPicker()
    await saveAs('Mine')
    await saveAs('Also mine')

    // Saving under a new name moves you into it — that is what Save As means, and
    // the next Grabar has to write somewhere unambiguous.
    const current = rows().filter((row) => within(row).queryByText(t('saves.current')) !== null)
    expect(current).toHaveLength(1)
    expect(within(current[0] as HTMLElement).getByText('Also mine')).toBeDefined()
  })
})

describe('saving again', () => {
  it('opens prefilled, so saving over your own game is two presses', async () => {
    render(<App />)
    await openPicker()
    await saveAs('Career')
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('action.close') }),
    )

    await act(async () => {
      advance(4)
    })
    const now = game().season.currentDate

    // Reopening finds the name already there — retyping it exactly would be the
    // alternative, and a save you cannot repeat is not a save.
    await openPicker()
    expect((screen.getByLabelText(t('saves.nameLabel')) as HTMLInputElement).value).toBe('Career')

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('action.save') }),
    )
    expect(screen.getByText(t('saves.confirmOverwrite', { name: 'Career' }))).toBeDefined()
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('action.save') }),
    )

    await waitFor(() => {
      expect(useGame.getState().saves[0]?.currentDate).toBe(now)
    })
    // The description has to follow the career, or the picker starts lying about
    // what is behind a row.
    expect(useGame.getState().saves).toHaveLength(1)
    expect(useGame.getState().saves[0]?.name).toBe('Career')
  })

  it('is what the next visit picks back up', async () => {
    // The startup contract: the slot pointer lives beside the language, outside
    // the save, and `restore()` follows it. Driven at the store because a page
    // reload is not something the test can stage.
    render(<App />)
    await openPicker()
    await saveAs('Continue me')
    const saved = game().season.currentDate

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('action.close') }),
    )
    await act(async () => {
      advance(5)
    })
    expect(game().season.currentDate).toBeGreaterThan(saved)

    expect(await useGame.getState().restore()).toBe(true)
    expect(game().season.currentDate).toBe(saved)
    expect(useGame.getState().needsSetup).toBe(false)
  })

  it('picks up a career from the unnamed slot, where a build before this left one', async () => {
    // Written the way an older build wrote it — straight to the unnamed slot,
    // with no summary. There is no longer a route through the UI that produces
    // one, which is the point: this is the shape already sitting in the browser
    // of anybody who played before named saves.
    render(<App />)
    const saved = game().season.currentDate
    await saveGame(game(), createRng(1).state(), AUTOSAVE_SLOT)

    await act(async () => {
      advance(5)
    })
    expect(useGame.getState().currentSlot).toBeNull()

    expect(await useGame.getState().restore()).toBe(true)
    expect(game().season.currentDate).toBe(saved)
  })

  it('adopts that career into the picker instead of leaving it invisible', async () => {
    // The dead end this whole change exists to remove: the career was saved, and
    // the list stayed empty however many times Save was pressed, because a slot
    // with no summary is a save the picker refuses to show.
    render(<App />)
    await saveGame(game(), createRng(1).state(), AUTOSAVE_SLOT)
    await useGame.getState().restore()

    await waitFor(() => {
      expect(useGame.getState().saves).toHaveLength(1)
    })
    expect(useGame.getState().saves[0]?.name).toBe(t('saves.adoptedName'))
    expect(useGame.getState().currentSlot).toBe(slotFor(t('saves.adoptedName')))

    // Moved, not copied — the same career twice is 165 KB of duplicate and a
    // second thing to keep in step.
    expect(await loadGame(AUTOSAVE_SLOT)).toBeNull()
  })

  it('stops pointing at a save it has just deleted', async () => {
    render(<App />)
    await openPicker()
    await saveAs('Doomed')
    expect(useGame.getState().currentSlot).not.toBeNull()

    fireEvent.click(
      within(rows()[0] as HTMLElement).getByRole('button', { name: t('saves.delete') }),
    )
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('saves.delete') }),
    )
    await waitFor(() => {
      expect(useGame.getState().saves).toHaveLength(0)
    })

    // The career in memory is untouched — it simply has nowhere to go back to.
    expect(useGame.getState().currentSlot).toBeNull()
    expect(useGame.getState().needsSetup).toBe(false)
  })

  it('never writes a save the picker cannot show', async () => {
    // What replaced "stays out of the picker while the career has never been
    // named" — that was this feature's dead end stated as a promise. Every write
    // now goes through the dialog, so a save and a row are the same act.
    render(<App />)
    await openPicker()
    await saveAs('Visible')

    expect(useGame.getState().saves).toHaveLength(1)
    expect(await loadGame(AUTOSAVE_SLOT)).toBeNull()
  })
})
