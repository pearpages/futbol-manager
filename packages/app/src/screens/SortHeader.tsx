import { nextSort, type Sort } from '../sorting.ts'

/**
 * A column header that sorts, cycling descending → ascending → source order.
 *
 * Lifted out of `MarketScreen` when the classification, the squad and the club
 * picker became the second use — the graduation its own stylesheet asked for.
 *
 * Two things here are load-bearing rather than decoration. `aria-sort` on the `<th>`
 * is what tells assistive technology the direction, which is why the ▾/▴ glyph can
 * be `aria-hidden` — and it has to be, because the header's accessible name is the
 * column label and several tests resolve headers by it. And the alignment class
 * stays on the `<th>`: the button is inline, so `text-align` on the cell is what
 * positions it.
 */
export function SortHeader<K extends string>({
  column,
  label,
  sort,
  onSort,
  align = '',
}: {
  readonly column: K
  readonly label: string
  readonly sort: Sort<K> | null
  readonly onSort: (next: Sort<K> | null) => void
  /** `'is-text'` for a column that reads left — the `data-table` convention. */
  readonly align?: string
}) {
  const active = sort !== null && sort.key === column
  return (
    <th className={align} aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        className={`data-table__sort${active ? ' is-active' : ''}`}
        onClick={() => onSort(nextSort(sort, column))}
      >
        {label}
        {active && <span aria-hidden="true">{sort.desc ? ' ▾' : ' ▴'}</span>}
      </button>
    </th>
  )
}
