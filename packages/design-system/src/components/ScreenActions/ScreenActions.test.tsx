import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScreenActions } from './ScreenActions.tsx'

describe('ScreenActions', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<ScreenActions />)).toBe('<div class="screen-actions"></div>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<ScreenActions className=" extra  more " id="x" />)).toBe(
      '<div class="screen-actions extra more" id="x"></div>',
    )
  })
})
