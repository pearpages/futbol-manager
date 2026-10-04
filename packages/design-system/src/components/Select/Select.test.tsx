import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Select } from './Select.tsx'

describe('Select', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Select />)).toBe('<select class="select"></select>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<Select className=" extra  more " id="x" />)).toBe(
      '<select class="select extra more" id="x"></select>',
    )
  })
})
