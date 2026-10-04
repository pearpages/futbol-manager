import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatValue } from './StatValue.tsx'

describe('StatValue', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<StatValue />)).toBe('<span class="stat__value"></span>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<StatValue className=" extra  more " id="x" />)).toBe(
      '<span class="stat__value extra more" id="x"></span>',
    )
  })

  it('renders as a <dd> when asked', () => {
    expect(renderToStaticMarkup(<StatValue as="dd" />)).toBe('<dd class="stat__value"></dd>')
  })
})
