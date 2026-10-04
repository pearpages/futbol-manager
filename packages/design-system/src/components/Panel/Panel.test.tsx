import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Panel } from './Panel.tsx'

describe('Panel', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Panel />)).toBe('<div class="panel"></div>')
  })

  it("adds the caller's classes after its own, and passes props through", () => {
    expect(renderToStaticMarkup(<Panel className=" extra  more " id="x" />)).toBe(
      '<div class="panel extra more" id="x"></div>',
    )
  })

  it('renders as a <header> when asked', () => {
    expect(renderToStaticMarkup(<Panel as="header" />)).toBe('<header class="panel"></header>')
  })
})
