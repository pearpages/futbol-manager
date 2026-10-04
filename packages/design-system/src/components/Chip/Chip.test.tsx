import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Chip } from './Chip.tsx'

describe('Chip', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Chip />)).toBe('<span class="chip"></span>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<Chip className=" extra  more " id="x" />)).toBe(
      '<span class="chip extra more" id="x"></span>',
    )
  })
})
