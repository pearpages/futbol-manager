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

  it('keeps a control beside the heading out of its name', () => {
    expect(
      renderToStaticMarkup(
        <ScreenHeading aside={<button type="button">i</button>}>Squad</ScreenHeading>,
      ),
    ).toBe(
      '<div class="screen__heading-row"><h2 class="screen__heading">Squad</h2><button type="button">i</button></div>',
    )
  })
})
