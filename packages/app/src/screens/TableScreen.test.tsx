import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { BANDS, bandFor } from './TableScreen.tsx'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { openScreen } from '../testing.ts'

/**
 * The qualification bands were previously an `if` chain, and fifth place fell
 * through every branch — it rendered with no colour and nothing explained why.
 * These walk every position instead of spot-checking, which is the difference
 * between catching that and not.
 */

const LEAGUE = 20

describe('bandFor', () => {
  it.each([
    [1, 'Champion'],
    [2, 'Champions League'],
    [3, 'Champions League'],
    [4, 'Champions League'],
    [5, 'Europa League'],
    [6, 'Conference League'],
    [18, 'Relegated'],
    [19, 'Relegated'],
    [20, 'Relegated'],
  ])('gives position %i the %s band', (position, label) => {
    expect(bandFor(position, LEAGUE)?.label).toBe(label)
  })

  it('leaves mid-table unbanded', () => {
    for (let position = 7; position <= 17; position++) {
      expect(bandFor(position, LEAGUE)).toBeNull()
    }
  })

  it('covers every position exactly once', () => {
    // The bug was a gap. This asserts there are none, anywhere.
    for (let position = 1; position <= LEAGUE; position++) {
      const matches = BANDS.filter((b) => bandFor(position, LEAGUE)?.className === b.className)
      expect(matches.length).toBeLessThanOrEqual(1)
    }
    const banded = Array.from({ length: LEAGUE }, (_, i) => bandFor(i + 1, LEAGUE)).filter(
      (b) => b !== null,
    )
    expect(banded).toHaveLength(9) // 1 champion + 3 UCL + 1 UEL + 1 UECL + 3 relegated
  })

  it('anchors relegation to the bottom, whatever the league size', () => {
    // Negative ranges count from the foot of the table, so M7's second division
    // will not need this rewritten for a different number of clubs.
    expect(bandFor(18, 20)?.label).toBe('Relegated')
    expect(bandFor(17, 20)).toBeNull()

    // In a 22-club league the drop is 20th–22nd, not 18th.
    expect(bandFor(19, 22)).toBeNull()
    expect(bandFor(20, 22)?.label).toBe('Relegated')
    expect(bandFor(22, 22)?.label).toBe('Relegated')
  })
})

describe('the legend', () => {
  it('explains every band the table can produce', () => {
    useGame.getState().newGame()
    const { container } = render(<App />)
    openScreen('Clasificación')

    // Scoped to the legend: each label also appears as a row's assistive text,
    // which is the point — but it means a document-wide query finds both.
    const legend = container.querySelector('.table-legend')
    expect(legend).not.toBeNull()

    const entries = [...(legend?.querySelectorAll('.table-legend__item') ?? [])].map((el) =>
      el.textContent?.trim(),
    )
    expect(entries).toEqual(BANDS.map((b) => b.label))
  })

  it('gives each banded row text an assistive reader can use', () => {
    // Colour alone would say nothing to a reader who cannot see it.
    useGame.getState().newGame()
    render(<App />)
    openScreen('Clasificación')

    const hidden = document.querySelectorAll('.data-table__band .visually-hidden')
    expect(hidden).toHaveLength(9)
  })
})
