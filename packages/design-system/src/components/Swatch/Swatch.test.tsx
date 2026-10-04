import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Swatch } from './Swatch.tsx'

describe('Swatch', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Swatch />)).toBe('<span class="swatch"></span>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<Swatch className=" extra  more " id="x" />)).toBe(
      '<span class="swatch extra more" id="x"></span>',
    )
  })
})
