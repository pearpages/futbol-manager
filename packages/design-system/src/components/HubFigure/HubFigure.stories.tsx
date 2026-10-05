import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { HubFigure } from './HubFigure.tsx'

/** The four staff who stand in the hub's corners. */
const meta: Meta = { title: 'Components/HubFigure', component: HubFigure }
export default meta
type Story = StoryObj

export const Staff: Story = {
  render: () => (
    <OnScreen row>
      {['assistant', 'trainer', 'agent', 'director'].map((figure) => (
        <HubFigure key={figure} figure={figure} src={`/art/${figure}.webp`} />
      ))}
    </OnScreen>
  ),
}
