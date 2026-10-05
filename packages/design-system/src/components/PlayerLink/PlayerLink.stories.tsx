import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { ScreenNote } from '../ScreenNote/ScreenNote.tsx'
import { PlayerLink } from './PlayerLink.tsx'

/** A player's name as the way into his ficha, wherever it appears. */
const meta: Meta = { title: 'Primitives/PlayerLink', component: PlayerLink }
export default meta
type Story = StoryObj

export const InASentence: Story = {
  render: () => (
    <OnScreen>
      <ScreenNote>
        El porter titular és <PlayerLink label="Thibaut Courtuis" onClick={() => {}} />.
      </ScreenNote>
    </OnScreen>
  ),
}
