import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Slider } from './Slider.tsx'

describe('Slider', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Slider />)).toBe('<input class="slider"/>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<Slider className=" extra  more " id="x" />)).toBe(
      '<input class="slider extra more" id="x"/>',
    )
  })
})
