import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pager } from './Pager.tsx'

describe('Pager', () => {
  it('names its arrows, disables them at the ends and calls back', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(
      <Pager
        onPrev={onPrev}
        onNext={onNext}
        prevLabel="Previous"
        nextLabel="Next"
        atStart
        atEnd={false}
      >
        <span>Matchday 3</span>
      </Pager>,
    )
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalledOnce()
    expect(onPrev).not.toHaveBeenCalled()
  })
})
