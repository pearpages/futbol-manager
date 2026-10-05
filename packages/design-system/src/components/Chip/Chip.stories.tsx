import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { Chip } from './Chip.tsx'

/** A player's position, coloured by line. */
const meta: Meta = { title: 'Primitives/Chip', component: Chip }
export default meta
type Story = StoryObj

export const Positions: Story = {
  render: () => (
    <OnScreen row>
      <Chip className="is-gk">POR</Chip>
      <Chip className="is-df">DEF</Chip>
      <Chip className="is-mf">MIG</Chip>
      <Chip className="is-fw">DAV</Chip>
    </OnScreen>
  ),
}
