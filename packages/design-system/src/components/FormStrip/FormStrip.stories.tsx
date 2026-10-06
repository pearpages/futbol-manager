import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { FormStrip } from './FormStrip.tsx'

/** The last results as pips, oldest first; empty ones are still to be played. */
const meta: Meta = { title: 'Components/FormStrip', component: FormStrip }
export default meta
type Story = StoryObj

export const Form: Story = {
  render: () => (
    <OnScreen>
      <FormStrip
        label="Últims resultats"
        pips={([null, null, 'win', 'draw', 'loss', 'win'] as const).map((outcome, i) => ({
          key: String(i),
          outcome,
          text: outcome ?? 'Sense jugar',
          ...(outcome === null ? {} : { mark: { win: 'G', draw: 'E', loss: 'P' }[outcome] }),
        }))}
      />
    </OnScreen>
  ),
}
