import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from './Button.tsx'

describe('Button', () => {
  it('renders the exact markup the screens wrote by hand', () => {
    expect(renderToStaticMarkup(<Button type="button">Torna</Button>)).toBe(
      '<button class="button" type="button">Torna</button>',
    )
  })

  it('marks the primary action with the accent class', () => {
    expect(renderToStaticMarkup(<Button primary className="hub__play" />)).toBe(
      '<button class="button is-primary hub__play"></button>',
    )
  })

  it('sets no type of its own', () => {
    expect(renderToStaticMarkup(<Button />)).not.toContain('type=')
  })
})
