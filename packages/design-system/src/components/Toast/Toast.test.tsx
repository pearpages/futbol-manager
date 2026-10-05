import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast.tsx'

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('announces, undoes, and dismisses after undoing', () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(
      <Toast message="XI changed" actionLabel="Undo" onAction={onAction} onDismiss={onDismiss} />,
    )
    expect(screen.getByRole('status').textContent).toContain('XI changed')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('keeps its clock through a re-render with a new callback', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const { rerender } = render(<Toast message="Saved" onDismiss={() => {}} duration={1000} />)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    rerender(<Toast message="Saved" onDismiss={onDismiss} duration={1000} />)
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('goes by itself', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<Toast message="Saved" onDismiss={onDismiss} duration={1000} />)
    expect(screen.queryByRole('button')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
