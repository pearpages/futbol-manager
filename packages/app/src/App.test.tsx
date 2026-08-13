import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SCHEMA_VERSION } from '@fm/persistence'
import { App } from './App.tsx'

describe('App', () => {
  it('renders through the full dependency chain', () => {
    // app → persistence → domain, resolved and rendered. Proves the jsdom project
    // and the workspace links, not the UI.
    //
    // Asserts against SCHEMA_VERSION rather than a literal: the version bumps with
    // every migration, and a test that fails on each one teaches people to edit
    // tests reflexively.
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Fútbol Manager' })).toBeDefined()
    expect(screen.getByText(new RegExp(`Save format v${SCHEMA_VERSION}`))).toBeDefined()
  })
})
