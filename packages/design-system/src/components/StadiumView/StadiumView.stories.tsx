import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { StadiumView } from './StadiumView.tsx'

/** The ground, picked by its size. */
const meta: Meta = { title: 'Components/StadiumView', component: StadiumView }
export default meta
type Story = StoryObj

export const FortyThousand: Story = {
  render: () => (
    <OnScreen>
      <StadiumView src="/art/stadium/40k.webp" seats="40k" />
    </OnScreen>
  ),
}
