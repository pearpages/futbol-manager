import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Hint } from './Hint.tsx'

describe('Hint', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Hint />)).toBe('<p class="hint"></p>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<Hint className=" extra  more " id="x" />)).toBe(
      '<p class="hint extra more" id="x"></p>',
    )
  })
})
