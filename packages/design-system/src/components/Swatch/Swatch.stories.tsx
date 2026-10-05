import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { Swatch } from './Swatch.tsx'

/** A band's colour beside its name, as the table legend shows them. */
const meta: Meta = { title: 'Primitives/Swatch', component: Swatch }
export default meta
type Story = StoryObj

export const Bands: Story = {
  render: () => (
    <OnScreen row>
      <Swatch className="is-champion" /> Campió
      <Swatch className="is-ucl" /> Champions
      <Swatch className="is-uel" /> Europa League
      <Swatch className="is-uecl" /> Conference
      <Swatch className="is-relegation" /> Descens
    </OnScreen>
  ),
}
