import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Screen } from './Screen.tsx'

describe('Screen', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Screen />)).toBe('<section class="screen"></section>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<Screen className=" extra  more " id="x" />)).toBe(
      '<section class="screen extra more" id="x"></section>',
    )
  })

  it('renders as a <div> when asked', () => {
    expect(renderToStaticMarkup(<Screen as="div" />)).toBe('<div class="screen"></div>')
  })
})
