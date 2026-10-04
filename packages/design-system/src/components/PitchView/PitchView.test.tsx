import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PitchView } from './PitchView.tsx'

const POSITIONS = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'] as const

describe('PitchView', () => {
  it('puts eleven named, rated discs on the pitch and reports a pick', () => {
    const onPick = vi.fn()
    render(
      <PitchView
        title="Lineup"
        selected="3"
        onPick={onPick}
        starters={POSITIONS.map((position, i) => ({
          id: String(i),
          position,
          name: `Player ${String(i)}`,
          rating: 60 + i,
          label: `Slot ${String(i)}`,
        }))}
      />,
    )
    const slots = screen.getAllByRole('button')
    expect(slots).toHaveLength(11)
    expect(screen.getByRole('button', { name: 'Slot 3' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Slot 9' }))
    expect(onPick).toHaveBeenCalledWith('9')
  })
})
