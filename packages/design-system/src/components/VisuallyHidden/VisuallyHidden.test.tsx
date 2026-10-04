import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VisuallyHidden } from './VisuallyHidden.tsx'

describe('VisuallyHidden', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<VisuallyHidden />)).toBe('<span class="visually-hidden"></span>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<VisuallyHidden className=" extra  more " id="x" />)).toBe(
      '<span class="visually-hidden extra more" id="x"></span>',
    )
  })
})
