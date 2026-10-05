import type { Meta, StoryObj } from '@storybook/react'
import { OnPanel } from '../../stories/Stage.tsx'
import { TileIcon } from '../TileIcon/TileIcon.tsx'
import { Segments } from './Segments.tsx'

/** Sibling views, one lit. With pictures when they are places (stacked on a phone). */
const meta: Meta = { title: 'Components/Segments', component: Segments }
export default meta
type Story = StoryObj

export const Places: Story = {
  render: () => (
    <OnPanel>
      <Segments
        label="Lliga"
        options={[
          { value: 'table', label: 'Classificació', icon: <TileIcon icon="table" /> },
          { value: 'results', label: 'Resultats', icon: <TileIcon icon="results" /> },
          { value: 'calendar', label: 'Calendari', icon: <TileIcon icon="calendar" /> },
        ]}
        value="table"
        onChange={() => {}}
      />
    </OnPanel>
  ),
}

export const Views: Story = {
  render: () => (
    <OnPanel>
      <Segments
        label="Resultats"
        options={[
          { value: 'round', label: 'Jornada' },
          { value: 'grid', label: 'Resultats' },
          { value: 'palmares', label: 'Palmarès' },
        ]}
        value="round"
        onChange={() => {}}
      />
    </OnPanel>
  ),
}
