import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App.tsx'

describe('App', () => {
  it('renders through the full dependency chain', () => {
    // app → persistence → domain, resolved and rendered. Proves the jsdom project
    // and the workspace links, not the UI.
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Fútbol Manager' })).toBeDefined()
    expect(screen.getByText(/Save format v1/)).toBeDefined()
  })
})
