import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ALL_CLUBS } from '@fm/data'
import { ClubBadge } from './ClubBadge.tsx'

/**
 * The badge as a rendered component.
 *
 * `badges.test.ts` covers the table and the stylesheet and cannot render JSX —
 * it is a `.ts`. What needs a DOM is the tooltip and, more to the point, the
 * claim that adding one changed no accessible name.
 */

const CLUB = ALL_CLUBS.find((c) => c.id === 'barcelona')
if (CLUB === undefined) throw new Error('no club')

/** The badge's own `<title>`, which is what a browser shows on hover. */
const titleOf = () => document.querySelector('.club-badge > title')?.textContent

describe('the hover tooltip', () => {
  it('names the club in full, not by its three-letter code', () => {
    render(<ClubBadge club={CLUB} />)

    // The code is already drawn on the badge; the tooltip exists to expand it.
    expect(titleOf()).toBe(CLUB.name)
    expect(titleOf()).not.toBe(CLUB.shortName)
  })

  it('is the first child, which is what makes it the tooltip', () => {
    render(<ClubBadge club={CLUB} />)

    // A `<title>` anywhere else in the SVG is a label for whatever encloses it
    // rather than for the badge, so position is the behaviour here.
    expect(document.querySelector('.club-badge')?.firstElementChild?.tagName).toBe('title')
  })
})

describe('what the tooltip must not disturb', () => {
  it('leaves an unlabelled badge hidden from assistive technology', () => {
    // The club's name is beside it on a table row, so announcing it again would
    // make a reader say the same word twice. The title rides inside the hidden
    // subtree, which is why it costs nothing here.
    render(<ClubBadge club={CLUB} />)

    const badge = document.querySelector('.club-badge')
    expect(badge?.getAttribute('aria-hidden')).toBe('true')
    expect(badge?.querySelector('title')).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('names a labelled badge once, from its aria-label', () => {
    // `aria-label` outranks `<title>`, so the accessible name is the club's name
    // exactly — not doubled, and not the tooltip's copy of it. Dropping the label
    // and letting the title name the badge must fail this.
    render(<ClubBadge club={CLUB} labelled />)

    const badge = screen.getByRole('img')
    expect(badge.getAttribute('aria-label')).toBe(CLUB.name)
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })
})
