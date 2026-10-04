import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlayerLink } from './PlayerLink.tsx'

describe('PlayerLink', () => {
  it('is a button named for the player, and says when it is pressed', () => {
    const onClick = vi.fn()
    render(<PlayerLink label="Thibaut Courtois" onClick={onClick} className="squad-screen__name" />)
    const link = screen.getByRole('button', { name: 'Thibaut Courtois' })
    expect(link.className).toBe('player-link squad-screen__name')
    fireEvent.click(link)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
