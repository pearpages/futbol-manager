import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NumberInput } from './NumberInput.tsx'

describe('NumberInput', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<NumberInput />)).toBe('<input class="number-input"/>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<NumberInput className=" extra  more " id="x" />)).toBe(
      '<input class="number-input extra more" id="x"/>',
    )
  })
})
