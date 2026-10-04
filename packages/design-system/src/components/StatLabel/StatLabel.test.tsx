import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatLabel } from './StatLabel.tsx'

describe('StatLabel', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<StatLabel />)).toBe('<span class="stat__label"></span>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<StatLabel className=" extra  more " id="x" />)).toBe(
      '<span class="stat__label extra more" id="x"></span>',
    )
  })

  it('renders as a <dt> when asked', () => {
    expect(renderToStaticMarkup(<StatLabel as="dt" />)).toBe('<dt class="stat__label"></dt>')
  })
})
