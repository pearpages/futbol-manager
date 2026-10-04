import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FieldLabel } from './FieldLabel.tsx'

describe('FieldLabel', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<FieldLabel />)).toBe('<label class="field__label"></label>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<FieldLabel className=" extra  more " id="x" />)).toBe(
      '<label class="field__label extra more" id="x"></label>',
    )
  })

  it('renders as a <span> when asked', () => {
    expect(renderToStaticMarkup(<FieldLabel as="span" />)).toBe(
      '<span class="field__label"></span>',
    )
  })
})
