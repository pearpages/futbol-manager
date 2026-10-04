import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AttrBar } from './AttrBar.tsx'

describe('AttrBar', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<AttrBar />)).toBe('<div class="attr"></div>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<AttrBar className=" extra  more " id="x" />)).toBe(
      '<div class="attr extra more" id="x"></div>',
    )
  })
})
