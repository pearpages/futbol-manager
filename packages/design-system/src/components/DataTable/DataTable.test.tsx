import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable } from './DataTable.tsx'

describe('DataTable', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<DataTable />)).toBe('<table class="data-table"></table>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<DataTable className=" extra  more " id="x" />)).toBe(
      '<table class="data-table extra more" id="x"></table>',
    )
  })
})
