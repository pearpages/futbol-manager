import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Stat } from './Stat.tsx'

describe('Stat', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Stat />)).toBe('<div class="stat"></div>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<Stat className=" extra  more " id="x" />)).toBe(
      '<div class="stat extra more" id="x"></div>',
    )
  })
})
