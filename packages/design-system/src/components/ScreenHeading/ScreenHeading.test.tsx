import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScreenHeading } from './ScreenHeading.tsx'

describe('ScreenHeading', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<ScreenHeading />)).toBe('<h2 class="screen__heading"></h2>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<ScreenHeading className=" extra  more " id="x" />)).toBe(
      '<h2 class="screen__heading extra more" id="x"></h2>',
    )
  })
})
