import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { TrophyIcon } from './TrophyIcon.tsx'

/** A trophy in the palmarès: won, and still to win. */
const meta: Meta = { title: 'Components/TrophyIcon', component: TrophyIcon }
export default meta
type Story = StoryObj

export const WonAndNot: Story = {
  render: () => (
    <OnScreen row>
      <TrophyIcon trophy="league" src="/art/league.webp" />
      <TrophyIcon trophy="league" src="/art/league.webp" empty />
    </OnScreen>
  ),
}
