import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { StatLabel } from '../StatLabel/StatLabel.tsx'
import { StatValue } from '../StatValue/StatValue.tsx'
import { Stat } from './Stat.tsx'

/** A labelled figure: the hub's vitals, the ficha's numbers. */
const meta: Meta = { title: 'Primitives/Stat', component: Stat }
export default meta
type Story = StoryObj

export const Figures: Story = {
  render: () => (
    <OnScreen row>
      <Stat>
        <StatLabel>Posició</StatLabel>
        <StatValue>8</StatValue>
      </Stat>
      <Stat>
        <StatLabel>Pressupost</StatLabel>
        <StatValue>21 M€</StatValue>
      </Stat>
      <Stat>
        <StatLabel>Data</StatLabel>
        <StatValue>15/08/2026</StatValue>
      </Stat>
    </OnScreen>
  ),
}
