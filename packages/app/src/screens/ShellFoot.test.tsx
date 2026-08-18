import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { AUTOSAVE_SLOT, loadGame } from '@fm/persistence'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { advance, openScreen } from '../testing.ts'
import { QUADRANTS } from './HubScreen.tsx'

/**
 * The bottom bar.
 *
 * Everything here is about *where a control is*, which is the one thing the suite
 * could not see before: the back button was in three different places and every
 * test found it by name, so nothing ever failed.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

const { t } = translatorFor('en')
const game = () => useGame.getState().game
const foot = () => document.querySelector('.shell__foot') as HTMLElement

/** Every screen a hub tile can reach, by the key the tile is named with. */
const TILES = QUADRANTS.flatMap((q) => q.tiles.filter((tile) => tile.to !== null).map((t) => t.key))

beforeEach(() => {
  useGame.getState().newGame(MID)
})

describe('where the controls are', () => {
  it('is on every screen, and every control in it is', () => {
    render(<App />)
    expect(foot()).not.toBeNull()

    for (const key of TILES) {
      openScreen(key)
      expect(foot()).not.toBeNull()
      // The three things you do to the game, reachable without going home.
      for (const label of ['action.save', 'action.saves', 'action.quit']) {
        expect(within(foot()).getByRole('button', { name: new RegExp(t(label)) })).toBeDefined()
      }
      fireEvent.click(within(foot()).getByRole('button', { name: t('action.back') }))
    }
  })

  it('puts back in the footer on every screen that has one, and nowhere else', () => {
    render(<App />)

    for (const key of TILES) {
      openScreen(key)
      const backs = screen.getAllByRole('button', { name: t('action.back') })
      // Exactly one, and it is the footer's. Six screens used to carry their own
      // at the foot of a right-hand rail, one in a full-width footer that
      // scrolled away with the table, and the ficha's was top-right.
      expect(backs).toHaveLength(1)
      expect(foot().contains(backs[0] as Node)).toBe(true)
      fireEvent.click(backs[0] as HTMLElement)
    }
  })

  it('has no back on the hub, because that is where back goes', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: t('action.back') })).toBeNull()
    expect(foot()).not.toBeNull()
  })

  it('is absent before a career exists', () => {
    // Nothing to save, nowhere to go back to, and no day to advance.
    useGame.getState().restart()
    render(<App />)
    expect(screen.getByRole('heading', { name: t('setup.heading') })).toBeDefined()
    expect(foot()).toBeNull()
  })
})

describe('the way back', () => {
  it('still returns a ficha to the list it was opened from, not to the hub', () => {
    // The position moved; the behaviour did not. A ficha opened from a
    // two-hundred-row market list has to go back to that list.
    render(<App />)
    openScreen('nav.squad')
    const name = game().squads[game().managedClubId]?.[0]?.name ?? ''
    fireEvent.click(screen.getByRole('button', { name }))
    expect(useGame.getState().screen).toBe('player')

    fireEvent.click(within(foot()).getByRole('button', { name: t('action.back') }))
    expect(useGame.getState().screen).toBe('squad')
  })
})

describe('the clock', () => {
  it('runs the day from a screen that is not the hub', () => {
    // The loop this exists for: during a transfer window you sat on the market
    // screen and had to walk home and back on every single tick.
    //
    // Round one is dated on the season start, so a fresh career is *already* on a
    // matchday and the footer offers the way to the hub rather than the day. Play
    // it first, which is what a manager does anyway.
    render(<App />)
    advance()
    openScreen('nav.market')
    const before = game().season.currentDate

    fireEvent.click(within(foot()).getByRole('button', { name: t('hub.advanceDay') }))

    expect(game().season.currentDate).toBeGreaterThan(before)
    expect(useGame.getState().screen).toBe('market')
  })

  it('offers no clock at all on a matchday, so no match starts from another screen', () => {
    // Playing a match stays a deliberate press made in one place, beside the
    // fixture. Round one is dated on the season start, so a fresh career is
    // already due — the corner is simply empty and Tornar is the way on.
    render(<App />)
    openScreen('nav.squad')

    const clock = [...foot().querySelectorAll('.shell__foot-group')].at(-1) as HTMLElement
    expect(within(clock).queryAllByRole('button')).toHaveLength(0)
    expect(
      screen.queryByRole('button', {
        name: new RegExp(`^${t('hub.playMatch', { opponent: '' }).trim()}`),
      }),
    ).toBeNull()
  })

  it('holds only Advance day, and nothing else', () => {
    // The right corner was three controls at one point — news, to-matchday and
    // the day. It is one.
    render(<App />)
    advance()
    openScreen('nav.market')

    const clock = [...foot().querySelectorAll('.shell__foot-group')].at(-1) as HTMLElement
    expect(
      within(clock)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([t('hub.advanceDay')])
  })

  it('runs the day from the hub too — one corner, every screen', () => {
    // `advance()` first, because round one is dated on the season start: a fresh
    // career is already on a matchday, when the corner is deliberately empty. The
    // previous version of this test asserted the *opposite* and passed for exactly
    // that reason, which is why it now plays the match before looking.
    render(<App />)
    advance()

    expect(within(foot()).getByRole('button', { name: t('hub.advanceDay') })).toBeDefined()
    // And the hub's own controls no longer carry it, so it is never on screen twice.
    const controls = document.querySelector('.hub__controls') as HTMLElement
    expect(within(controls).queryByRole('button', { name: t('hub.advanceDay') })).toBeNull()
    expect(within(controls).getByRole('button', { name: t('hub.toMatchday') })).toBeDefined()
  })

  it('never shows Advance day twice, whatever the day', () => {
    // The guard on the guard: two clocks would both answer to `ADVANCE()` and the
    // helper would throw on the ambiguity rather than the assertion catching it.
    render(<App />)
    for (let day = 0; day < 20; day++) {
      expect(screen.queryAllByRole('button', { name: t('hub.advanceDay') }).length).toBeLessThan(2)
      advance()
    }
  })
})

describe('quick save', () => {
  it('writes in one press once the career has a save, and says it did', async () => {
    render(<App />)
    // The first save has to be named — there is nothing to write *back* to yet.
    fireEvent.click(within(foot()).getByRole('button', { name: t('action.saves') }))
    fireEvent.change(screen.getByLabelText(t('saves.nameLabel')), { target: { value: 'Mine' } })
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('saves.write') }),
    )
    await waitFor(() => {
      expect(useGame.getState().saves).toHaveLength(1)
    })
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('action.close') }),
    )

    await waitFor(() => {
      expect(useGame.getState().saving).toBe(false)
    })
    await act(async () => {
      advance(3)
    })
    const now = game().season.currentDate

    // One press. No dialog.
    fireEvent.click(within(foot()).getByRole('button', { name: t('action.save') }))
    await waitFor(() => {
      expect(useGame.getState().saves[0]?.currentDate).toBe(now)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    // And it says so — a save with no visible result is what got this reported.
    expect(within(foot()).getByRole('status').textContent).toBe(
      t('action.saved', { date: translatorFor('en').date(now) }),
    )
  })

  it('sends a career with no save to the dialog instead of writing an invisible one', async () => {
    // `currentSlot` is null on a fresh career, and quick-saving there would land
    // in the unnamed slot the picker cannot show — the exact dead end this
    // feature shipped with the first time.
    render(<App />)
    expect(useGame.getState().currentSlot).toBeNull()

    fireEvent.click(within(foot()).getByRole('button', { name: t('action.save') }))

    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByLabelText(t('saves.nameLabel'))).toBeDefined()
    await waitFor(() => {
      expect(useGame.getState().saving).toBe(false)
    })
    // The claim is that nothing was written where the picker cannot show it —
    // asserted against storage rather than against `saves.length`, which another
    // test's in-flight write can reach across into.
    expect(await loadGame(AUTOSAVE_SLOT)).toBeNull()
    expect(useGame.getState().currentSlot).toBeNull()
  })
})
