import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SortHeader } from './SortHeader.tsx'

function header(sort: { key: 'age'; desc: boolean } | null, onSort = vi.fn()) {
  render(
    <table>
      <thead>
        <tr>
          <SortHeader column="age" label="Age" sort={sort} onSort={onSort} />
        </tr>
      </thead>
    </table>,
  )
  return onSort
}

describe('SortHeader', () => {
  it('says how the column is sorted', () => {
    header({ key: 'age', desc: true })
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('descending')
  })

  it('asks for the next sort when pressed: highest first', () => {
    const onSort = header(null)
    fireEvent.click(screen.getByRole('button', { name: 'Age' }))
    expect(onSort).toHaveBeenCalledWith({ key: 'age', desc: true })
  })

  it('names an abbreviated column in full, and keeps the letters on screen', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortHeader column="won" label="W" fullLabel="Won" sort={null} onSort={() => {}} />
          </tr>
        </thead>
      </table>,
    )
    const button = screen.getByRole('button', { name: 'Won' })
    expect(button.querySelector('[aria-hidden="true"]')?.textContent).toBe('W')
    expect(screen.getByRole('columnheader', { name: 'Won' })).toBeDefined()
  })
})
