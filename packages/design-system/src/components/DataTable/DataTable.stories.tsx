import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { OnScreen } from '../../stories/Stage.tsx'
import { SortHeader } from '../SortHeader/SortHeader.tsx'
import type { Sort } from '../SortHeader/sorting.ts'
import { DataTable } from './DataTable.tsx'

/** A table on the screen material: sortable headers, a band, your own row. */
const meta: Meta = { title: 'Primitives/DataTable', component: DataTable }
export default meta
type Story = StoryObj

function Table() {
  const [sort, setSort] = useState<Sort<'club' | 'points'> | null>({ key: 'points', desc: true })
  return (
    <DataTable>
      <thead className="data-table__head">
        <tr>
          <th aria-label="Classificació" />
          <SortHeader column="club" label="Club" sort={sort} onSort={setSort} align="is-text" />
          <th>PJ</th>
          <SortHeader column="points" label="Pts" sort={sort} onSort={setSort} />
        </tr>
      </thead>
      <tbody>
        <tr className="data-table__row">
          <td className="data-table__band is-champion" />
          <td className="is-text">Sevilla</td>
          <td className="data-table__num">3</td>
          <td className="data-table__num">7</td>
        </tr>
        <tr className="data-table__row is-you">
          <td className="data-table__band is-ucl" />
          <td className="is-text">Madrid</td>
          <td className="data-table__num">3</td>
          <td className="data-table__num">6</td>
        </tr>
        <tr className="data-table__row">
          <td className="data-table__band" />
          <td className="is-text">Getafe</td>
          <td className="data-table__num">3</td>
          <td className="data-table__num">4</td>
        </tr>
      </tbody>
    </DataTable>
  )
}

export const Classification: Story = {
  render: () => (
    <OnScreen>
      <Table />
    </OnScreen>
  ),
}
