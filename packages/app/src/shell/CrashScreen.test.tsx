import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { createRng } from '@fm/domain'
import { loadGame, saveGame, slotFor } from '@fm/persistence'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { CrashBoundary } from './CrashScreen.tsx'

/**
 * A save that is not a career (security.md, "Saves are trusted on load"): it is
 * refused on load rather than handed to a screen, and anything that still throws
 * while rendering lands on a screen that offers a way out.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

const { t } = translatorFor('en')
const BROKEN = slotFor('Broken')
const garbage = { clubs: 'not a league' }

beforeEach(() => {
  useGame.getState().newGame(MID)
  useGame.getState().setLanguage('en')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a save that does not hold a career', () => {
  it('is not restored on reload, and the game in memory is left alone', async () => {
    await saveGame(garbage, createRng(1).state(), BROKEN)
    useGame.setState({ currentSlot: BROKEN })
    const before = useGame.getState().game

    expect(await useGame.getState().restore()).toBe(false)
    expect(useGame.getState().game).toBe(before)
  })

  it('is not loaded from the save list', async () => {
    await saveGame(garbage, createRng(1).state(), BROKEN)
    const before = useGame.getState().game

    expect(await useGame.getState().load(BROKEN)).toBe(false)
    expect(useGame.getState().game).toBe(before)
  })
})

describe('the crash screen', () => {
  function Boom(): React.JSX.Element {
    throw new Error('boom')
  }

  function crash() {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <CrashBoundary>
        <Boom />
      </CrashBoundary>,
    )
  }

  it('replaces a render that throws, and offers a reload', () => {
    crash()
    expect(screen.getByRole('heading', { name: t('crash.title') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('crash.reload') })).toBeTruthy()
  })

  it('deletes the save only once asked twice', async () => {
    await saveGame(garbage, createRng(1).state(), BROKEN)
    useGame.setState({ currentSlot: BROKEN })
    const reload = vi.fn()
    vi.stubGlobal('location', { ...globalThis.location, reload })
    crash()

    fireEvent.click(screen.getByRole('button', { name: t('crash.deleteSave') }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: t('action.cancel') }))
    expect(await loadGame(BROKEN)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('crash.deleteSave') }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('saves.delete') }),
    )
    await waitFor(() => {
      expect(reload).toHaveBeenCalled()
    })
    expect(await loadGame(BROKEN)).toBeNull()
    vi.unstubAllGlobals()
  })
})
