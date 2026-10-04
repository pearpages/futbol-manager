import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClubCell } from './ClubCell.tsx'

describe('ClubCell', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<ClubCell />)).toBe('<span class="club-cell"></span>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<ClubCell className=" extra  more " id="x" />)).toBe(
      '<span class="club-cell extra more" id="x"></span>',
    )
  })
})
