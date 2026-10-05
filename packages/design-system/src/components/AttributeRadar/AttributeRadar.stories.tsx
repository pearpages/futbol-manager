import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { AttributeRadar } from './AttributeRadar.tsx'

/** The eight attributes as a radar, with another player's for comparison. */
const meta: Meta = { title: 'Components/AttributeRadar', component: AttributeRadar }
export default meta
type Story = StoryObj

export const Compared: Story = {
  render: () => (
    <OnScreen>
      <AttributeRadar
        values={[76, 79, 80, 79, 78, 80, 87, 76]}
        compare={[60, 85, 70, 72, 55, 65, 20, 80]}
        labels={['VEL', 'DEF', 'PAS', 'REG', 'ENT', 'AER', 'POR', 'RES']}
        title="Atributs"
      />
    </OnScreen>
  ),
}
