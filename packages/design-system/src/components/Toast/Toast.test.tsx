import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast.tsx'

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('undoes, and dismisses after undoing', () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(
      <Toast
        message="XI changed"
        actionLabel="Undo"
        closeLabel="Close"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('announces through a region that is there before the words', () => {
    vi.useFakeTimers()
    render(<Toast message="Saved" onDismiss={() => {}} />)
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(status.textContent).toBe('Saved')
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

  it('holds while the pointer is on it', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<Toast className="t" message="Saved" onDismiss={onDismiss} duration={1000} />)
    fireEvent.pointerEnter(screen.getByText('Saved'))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('waits for an action rather than leaving on a timer', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(
      <Toast
        message="XI changed"
        actionLabel="Undo"
        onAction={() => {}}
        closeLabel="Close"
        onDismiss={onDismiss}
        duration={1000}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('gives focus back to where it was when it leaves', () => {
    function Host() {
      const [shown, setShown] = useState(false)
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setShown(true)
            }}
          >
            Change
          </button>
          {shown && (
            <Toast
              message="Changed"
              actionLabel="Undo"
              onAction={() => {}}
              onDismiss={() => {
                setShown(false)
              }}
            />
          )}
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Change' })
    opener.focus()
    fireEvent.click(opener)
    const undo = screen.getByRole('button', { name: 'Undo' })
    undo.focus()
    fireEvent.click(undo)
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
