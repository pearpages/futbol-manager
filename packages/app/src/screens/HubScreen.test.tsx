import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { computeTable, nextFixtureFor, overall, recentResultsFor, type Player } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { bandFor } from '../bands.ts'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { advance, advanceUntil, back, openScreen, labelStem } from '../testing.ts'
import { translatorFor } from '../i18n/useT.ts'
import { FORM_MATCHES, FormStrip } from './FormStrip.tsx'

/**
 * The hub, the news feed and matchday — the three things a player could not see.
 *
 * All deterministic. The statistical claims still live in the domain harness.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

beforeEach(() => {
  useGame.getState().newGame(MID)
})

const { t } = translatorFor('en')
const game = () => useGame.getState().game

describe('Avui', () => {
  it('is where the app opens: the next match, where you stand, the news', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: t('tab.today') })).toBeDefined()
    expect(screen.getByRole('heading', { name: t('hub.nextMatch') })).toBeDefined()
    expect(screen.getByRole('heading', { name: t('hub.news') })).toBeDefined()
  })

  it('says what the board wants, and opens its page', () => {
    render(<App />)
    const target = screen.getByRole('button', {
      name: t('hub.boardTarget', { target: game().board.target }),
    })
    fireEvent.click(target)
    expect(useGame.getState().screen).toBe('decisiones')
  })

  it('holds no menu of tiles: the places are the tabs (ADR 0022)', () => {
    render(<App />)
    expect(document.querySelector('.hub__tile')).toBeNull()
    expect(screen.queryByRole('button', { name: t('nav.training') })).toBeNull()
  })
})

describe('knowing when you play', () => {
  it('names the next opponent on the hub and in the bar', () => {
    render(<App />)
    const fixture = nextFixtureFor(game().season.fixtures, MID)
    if (fixture === null) throw new Error('no fixture')
    const opponentId = fixture.homeId === MID ? fixture.awayId : fixture.homeId
    const opponent = game().clubs.find((c) => c.id === opponentId)?.name ?? ''

    expect(screen.getAllByText(new RegExp(opponent)).length).toBeGreaterThan(0)
  })

  it('draws both crests with the home club first, from either end of the fixture', () => {
    // One fixture, read from both dressing rooms.
    //
    // Order is now the only thing on screen saying where the match is played, so
    // it must describe the *fixture* rather than follow *you* — which is exactly
    // what building the row out of `matchday.opponent` alone would do. A single
    // career cannot see that: whichever side happened to come first would look
    // right. Driving the same fixture from both clubs is what makes it visible,
    // the same shape the results grid's axes needed.
    const fixture = nextFixtureFor(game().season.fixtures, MID)
    if (fixture === null) throw new Error('no fixture')
    const home = game().clubs.find((c) => c.id === fixture.homeId)
    const away = game().clubs.find((c) => c.id === fixture.awayId)
    expect(home?.shortName).not.toBe(away?.shortName)

    for (const managed of [fixture.homeId, fixture.awayId]) {
      cleanup()
      useGame.getState().newGame(managed)
      render(<App />)

      const codes = [...document.querySelectorAll('.hub__fixture .club-badge__code')]
      expect(codes.map((c) => c.textContent)).toEqual([home?.shortName, away?.shortName])

      // Which side is yours, since the order alone cannot say it.
      const yours = document.querySelectorAll('.hub__side.is-you')
      expect(yours).toHaveLength(1)
      expect(yours[0]?.querySelector('.hub__side-name')?.textContent).toBe(
        managed === fixture.homeId ? home?.name : away?.name,
      )

      // The venue letter left the screen with the crests taking over. It must not
      // have left the page: order carries it for the eye, this sentence for
      // anyone who cannot see the order.
      const spoken = document.querySelector('.hub__fixture .visually-hidden')?.textContent ?? ''
      expect(spoken).toContain(managed === fixture.homeId ? away?.name : home?.name)
      expect(spoken).toContain(managed === fixture.homeId ? '(H)' : '(A)')
    }
  })

  it('opens a new career with the first fixture already due', () => {
    // Round one is dated on the season start, so kicking off is the first thing
    // asked of you — and it is a distinct button, not Advance day.
    render(<App />)
    expect(
      screen.getByRole('button', {
        name: new RegExp(`^${t('hub.playMatch', { opponent: '' }).trim()}`),
      }),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: t('hub.advanceDay') })).toBeNull()
  })

  it('plays only when you press play', () => {
    render(<App />)
    const played = () => game().season.fixtures.filter((f) => f.result !== null).length
    expect(played()).toBe(0)

    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`^${t('hub.playMatch', { opponent: '' }).trim()}`),
      }),
    )
    expect(played()).toBe(10)
  })

  it('runs the clock to matchday and stops on it, not past it', () => {
    render(<App />)
    // Clear the opening fixture so there is a gap to run through.
    advance()

    const target = nextFixtureFor(game().season.fixtures, MID)
    if (target === null) throw new Error('no fixture')
    expect(game().season.currentDate).toBeLessThan(target.date)

    fireEvent.click(screen.getByRole('button', { name: t('hub.toMatchday') }))

    expect(game().season.currentDate).toBe(target.date)
    // Stopped *on* it: the fixture is still unplayed and the button now offers it.
    expect(game().season.fixtures.find((f) => f.id === target.id)?.result).toBeNull()
    expect(
      screen.getByRole('button', {
        name: new RegExp(`^${t('hub.playMatch', { opponent: '' }).trim()}`),
      }),
    ).toBeDefined()
  })
})

describe('the weak-XI warning', () => {
  it('stays quiet when the strongest XI is picked', () => {
    render(<App />)
    expect(screen.queryByText(/not your strongest/)).toBeNull()
  })

  it('speaks up when it is not', () => {
    // The case M4c created: signing a player no longer selects him, so a manager
    // can buy a keeper and play the old one with nothing to tell him.
    const state = game()
    const squad = state.squads[MID] ?? []
    const lineup = state.lineups[MID]
    if (lineup === undefined) throw new Error('no lineup')

    // Swap the best defender out for the worst reserve defender. Deliberately the
    // widest legal swap rather than the first pair found: `teamRating` clamps to a
    // whole number, so a swap between two adjacent squad members can round away to
    // no change at all and leave this asserting nothing. That is squad-dependent,
    // which means it passes or fails on which league happens to be loaded.
    const starters = new Set(lineup.starters)
    const byQuality = (a: Player, b: Player) => overall(b) - overall(a)
    const out = squad.filter((p) => starters.has(p.id) && p.position === 'DF').sort(byQuality)[0]
    const bench = squad
      .filter((p) => !starters.has(p.id) && p.position === 'DF')
      .sort(byQuality)
      .at(-1)
    if (out === undefined || bench === undefined) throw new Error('no swap available')
    expect(overall(out), 'the swap must actually weaken the XI').toBeGreaterThan(overall(bench))

    useGame.getState().dispatch({
      type: 'SetLineup',
      clubId: MID,
      lineup: { ...lineup, starters: lineup.starters.map((id) => (id === out.id ? bench.id : id)) },
    })

    render(<App />)
    expect(screen.getAllByText(/not your strongest/).length).toBeGreaterThan(0)
  })
})

describe('the news feed', () => {
  it('says nothing before anything has happened', () => {
    render(<App />)
    expect(screen.getByText(t('hub.noNews'))).toBeDefined()
  })

  it('reports your own result in words', () => {
    render(<App />)
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`^${t('hub.playMatch', { opponent: '' }).trim()}`),
      }),
    )
    expect(screen.getAllByText(/(Beat|Lost to|Drew with)/).length).toBeGreaterThan(0)
  })

  it('gives the form strip a club name with its article', () => {
    // Driven at the component rather than through a career, because it needs a
    // club that starts with a vowel and which of those you play is the
    // fixture list's business. Catalan elides — `contra el Elche` is what this
    // read while the strip was handed a bare name.
    const catalan = translatorFor('ca')
    const elche = DEFAULT_CLUBS.find((c) => c.name === 'Elche')
    if (elche === undefined) throw new Error('no such club')

    render(
      <FormStrip
        results={[
          {
            fixtureId: 'f1' as never,
            opponentId: elche.id,
            home: true,
            ours: 2,
            theirs: 0,
            outcome: 'win',
          },
        ]}
        names={() => elche.name}
        translator={catalan}
      />,
    )

    expect(screen.getByText('Victòria contra l’Elche 2–0')).toBeDefined()
  })

  it('reports a transfer you would otherwise have missed', () => {
    render(<App />)
    openScreen('nav.market')

    // Bid at the asking price, then wait somewhere else — which is exactly the
    // situation where an answer used to arrive silently.
    const row = document.querySelector('.market-screen__main tbody tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: labelStem(t('market.bid')) }))
    fireEvent.click(screen.getByRole('button', { name: t('market.makeBid') }))

    back()
    advanceUntil(() => screen.queryAllByText(/Fee agreed|was rejected|Counter-offer/).length > 0, 8)

    expect(screen.getAllByText(/Fee agreed|was rejected|Counter-offer/).length).toBeGreaterThan(0)
  })
})

describe('the form strip', () => {
  const pips = () => [...document.querySelectorAll('.form-strip__pip')]
  const outcomeOf = (pip: Element) =>
    ['win', 'draw', 'loss'].find((o) => pip.classList.contains(`is-${o}`)) ?? null

  it('always shows ten cells, grey before a ball is kicked', () => {
    render(<App />)

    expect(pips()).toHaveLength(FORM_MATCHES)
    expect(pips().map(outcomeOf)).toEqual(Array.from({ length: FORM_MATCHES }, () => null))
    // Colour is never the only signal.
    expect(pips()[0]?.textContent).toBe(t('form.notPlayed'))
  })

  it('fills from the right, so the newest result is the last square', () => {
    render(<App />)
    advance() // round one is dated on the season start, so this plays it

    const results = recentResultsFor(game().season.fixtures, MID, FORM_MATCHES)
    expect(results).toHaveLength(1)

    expect(pips()).toHaveLength(FORM_MATCHES)
    expect(
      pips()
        .slice(0, FORM_MATCHES - 1)
        .map(outcomeOf),
    ).toEqual(Array.from({ length: FORM_MATCHES - 1 }, () => null))
    expect(outcomeOf(pips().at(-1) as Element)).toBe(results[0]?.outcome)
  })

  /**
   * Recomputed from the fixtures rather than asserted against a fixed list: the
   * claim is that the strip agrees with what was actually played, in order.
   */
  it('agrees with the fixtures once ten are in the books', () => {
    render(<App />)
    advanceUntil(
      () => recentResultsFor(game().season.fixtures, MID, FORM_MATCHES).length === FORM_MATCHES,
      // A round is a week, so filling ten squares takes ~70 ticks. Sized well clear
      // of that: too low fails as "still not done after N presses", which reads as a
      // broken strip rather than a short guard.
      120,
    )

    const results = recentResultsFor(game().season.fixtures, MID, FORM_MATCHES)
    expect(pips().map(outcomeOf)).toEqual(results.map((r) => r.outcome))
    // Every square now carries a real sentence naming the opponent.
    const opponent = game().clubs.find((c) => c.id === results.at(-1)?.opponentId)?.name
    expect(pips().at(-1)?.textContent).toContain(opponent)
  })

  it('survives a reload, because it is built from fixtures and not the feed', () => {
    render(<App />)
    advanceUntil(() => recentResultsFor(game().season.fixtures, MID, FORM_MATCHES).length >= 2, 30)
    const before = pips().map(outcomeOf)

    // The feed is session-only and is cleared on load; the fixtures are not.
    useGame.setState({ feed: [] })
    expect(pips().map(outcomeOf)).toEqual(before)
    expect(before.filter(Boolean).length).toBeGreaterThanOrEqual(2)
  })
})

describe('the position stat', () => {
  const stat = () => document.querySelector('.hub__position')
  const placeOf = (clubId: typeof MID) => {
    const table = computeTable(game().competition.clubIds, game().season.fixtures)
    return { position: table.findIndex((r) => r.clubId === clubId) + 1, total: table.length }
  }

  it('shows the place the classification gives you', () => {
    render(<App />)
    advance()

    const { position } = placeOf(MID)
    expect(position).toBeGreaterThan(0)
    expect(stat()?.textContent).toContain(String(position))
  })

  it('takes the band colour, and names it for anyone who cannot see colour', () => {
    // Drive to a club that is actually in a band rather than hoping the managed one
    // lands in one — a test that only passes on a lucky table proves nothing.
    render(<App />)
    advanceUntil(() => placeOf(MID).position > 0, 5)

    const { position, total } = placeOf(MID)
    const band = bandFor(position, total)
    if (band === null) {
      expect(stat()?.className).not.toMatch(/is-(champion|ucl|uel|uecl|relegation)/)
    } else {
      expect(stat()?.className).toContain(band.className)
      expect(stat()?.textContent).toContain(t(band.label))
      expect(stat()?.getAttribute('title')).toBe(t(band.label))
    }
  })

  it('leaves mid-table uncoloured, which is what mid-table means', () => {
    // The guard on the guard: a rule that painted every position would satisfy the
    // test above whenever the managed club happened to sit in a band.
    render(<App />)
    for (const position of [7, 8, 12, 17]) {
      expect(bandFor(position, 20), `position ${String(position)}`).toBeNull()
    }
    // And a banded one still resolves, so the check above is not vacuous.
    expect(bandFor(1, 20)?.className).toBe('is-champion')
    expect(bandFor(20, 20)?.className).toBe('is-relegation')
  })
})

describe('the unread count', () => {
  const newsButton = () => screen.getByRole('button', { name: new RegExp(t('hub.readNews')) })
  const panel = () =>
    screen.getByRole('heading', { name: t('hub.news') }).closest('section') as HTMLElement

  it('counts what happened and survives navigating away and back', () => {
    // The condition that makes the day clock living in the footer safe: news
    // arrives on ordinary ticks, and the count has to still be there when you
    // come home rather than being cleared by the journey.
    useGame.getState().newGame(MID)
    render(<App />)
    expect(useGame.getState().unread).toBe(0)

    advanceUntil(() => useGame.getState().unread > 0, 120)
    const count = useGame.getState().unread
    expect(count).toBeGreaterThan(0)

    openScreen('nav.squad')
    back()

    expect(useGame.getState().unread).toBe(count)
    expect(within(panel()).getByText(String(count))).toBeDefined()
  })

  it('clears on a press, not on arriving at the hub', () => {
    // The panel is always on screen here, so clearing on sight is what made the
    // first version of this badge useless — it could never be seen.
    useGame.getState().newGame(MID)
    render(<App />)
    advanceUntil(() => useGame.getState().unread > 0, 120)
    openScreen('nav.squad')
    back()
    expect(useGame.getState().unread).toBeGreaterThan(0)

    fireEvent.click(newsButton())

    expect(useGame.getState().unread).toBe(0)
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('does not light up for your own clicks', () => {
    // `DayAdvanced` fires on every tick and `TacticsChanged` fires because you
    // just did that. Counting raw events would leave the pill permanently lit,
    // which is the same as having no pill.
    useGame.getState().newGame(MID)
    render(<App />)
    openScreen('nav.lineup')
    const before = useGame.getState().unread

    fireEvent.change(
      screen.getByLabelText(new RegExp(t('lineup.approach', { approach: '' }).trim())),
      { target: { value: '70' } },
    )

    expect(useGame.getState().unread).toBe(before)
  })

  it('says the number once, not twice', () => {
    useGame.getState().newGame(MID)
    render(<App />)
    advanceUntil(() => useGame.getState().unread > 0, 120)
    const count = useGame.getState().unread

    const button = newsButton()
    expect(
      within(button).getByText(new RegExp(t('action.unread.other', { count }))).className,
    ).toBe('visually-hidden')
    expect(document.querySelector('.hub__unread')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('leaves the panel heading alone, which other screens find it by', () => {
    // The count lived inside the `<h2>` for one iteration and made its accessible
    // name "News3 unread" — which two other test files look this panel up by.
    useGame.getState().newGame(MID)
    render(<App />)
    advanceUntil(() => useGame.getState().unread > 0, 120)

    expect(screen.getByRole('heading', { name: t('hub.news') })).toBeDefined()
  })
})
