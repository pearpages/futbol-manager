import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScreenNote } from './ScreenNote.tsx'

describe('ScreenNote', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<ScreenNote />)).toBe('<p class="screen__note"></p>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<ScreenNote className=" extra  more " id="x" />)).toBe(
      '<p class="screen__note extra more" id="x"></p>',
    )
  })
})
