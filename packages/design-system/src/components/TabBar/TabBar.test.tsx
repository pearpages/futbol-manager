import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TabBar } from './TabBar.tsx'

const items = [
  { value: 'today', label: 'Today', icon: 'home' },
  { value: 'market', label: 'Market', icon: 'transfer', badge: 2, badgeLabel: 'new' },
  { value: 'club', label: 'Club', icon: 'club', badge: 0 },
] as const

describe('TabBar', () => {
  it('names each place by its word, marks the current one and reports another', () => {
    const onChange = vi.fn()
    render(<TabBar label="Sections" items={items} value="today" onChange={onChange} />)
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(nav).toBeDefined()
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Club' }).getAttribute('aria-current')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Club' }))
    expect(onChange).toHaveBeenCalledWith('club')
  })

  it('shows a count only when there is one, and says what it counts', () => {
    render(<TabBar label="Sections" items={items} value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Market 2 new' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Club' }).textContent).toBe('Club')
  })
})
