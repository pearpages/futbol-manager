import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Field } from './Field.tsx'

describe('Field', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Field />)).toBe('<div class="field"></div>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<Field className=" extra  more " id="x" />)).toBe(
      '<div class="field extra more" id="x"></div>',
    )
  })

  it('renders as a <label> when asked', () => {
    expect(renderToStaticMarkup(<Field as="label" />)).toBe('<label class="field"></label>')
  })
})
