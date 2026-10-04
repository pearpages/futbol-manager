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
})
