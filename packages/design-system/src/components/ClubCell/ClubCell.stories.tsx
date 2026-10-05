import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { Badge, BadgeDefs } from '../Badge/Badge.tsx'
import { ClubCell } from './ClubCell.tsx'

/** A club in a list: its badge and its name. */
const meta: Meta = { title: 'Primitives/ClubCell', component: ClubCell }
export default meta
type Story = StoryObj

export const Club: Story = {
  render: () => (
    <OnScreen>
      <BadgeDefs />
      <ClubCell>
        <Badge
          badge={{ colours: 'white', pattern: 'solid', shape: 'circle' }}
          code="MAD"
          name="Madrid"
        />
        Madrid
      </ClubCell>
    </OnScreen>
  ),
}
