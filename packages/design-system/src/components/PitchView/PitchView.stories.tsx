import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { PitchView } from './PitchView.tsx'
import type { Position } from './pitch.ts'

/** The XI on the pitch; a disc is a control. One is selected. */
const meta: Meta = { title: 'Components/PitchView', component: PitchView }
export default meta
type Story = StoryObj

const SHAPE: readonly Position[] = [
  'GK',
  'DF',
  'DF',
  'DF',
  'DF',
  'MF',
  'MF',
  'MF',
  'MF',
  'FW',
  'FW',
]

export const FourFourTwo: Story = {
  render: () => (
    <OnScreen>
      <div className="preview-pitch">
        <PitchView
          title="Alineació"
          selected="9"
          onPick={() => {}}
          starters={SHAPE.map((position, i) => ({
            id: String(i),
            position,
            name: `Jugador ${i + 1}`,
            rating: 70 + i,
            label: `Jugador ${i + 1}`,
          }))}
        />
      </div>
    </OnScreen>
  ),
}
