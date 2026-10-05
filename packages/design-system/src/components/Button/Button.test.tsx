import { render, screen } from '@testing-library/react'
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

  it('puts a hidden glyph before the label, and keeps the name the label', () => {
    render(
      <Button type="button" icon="save">
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.classList.contains('has-icon')).toBe(true)
    const svg = button.firstElementChild
    expect(svg?.tagName.toLowerCase()).toBe('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders no glyph and no extra class without one', () => {
    render(<Button type="button">Plain</Button>)
    const button = screen.getByRole('button', { name: 'Plain' })
    expect(button.querySelector('svg')).toBeNull()
    expect(button.className).toBe('button')
  })
})
