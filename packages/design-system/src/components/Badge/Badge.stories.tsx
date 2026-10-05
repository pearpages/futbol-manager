import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { Badge, BadgeDefs } from './Badge.tsx'

/** A club's badge, drawn from its kit: five shapes, five patterns. Never a real crest. */
const meta: Meta = { title: 'Components/Badge', component: Badge }
export default meta
type Story = StoryObj

export const Shapes: Story = {
  render: () => (
    <OnScreen row>
      <BadgeDefs />
      <Badge
        badge={{ colours: 'white', pattern: 'solid', shape: 'circle' }}
        code="MAD"
        name="Madrid"
        size="lg"
        labelled
      />
      <Badge
        badge={{ colours: 'garnet-blue', pattern: 'stripes', shape: 'shield' }}
        code="BAR"
        name="Barcelona"
        size="lg"
        labelled
      />
      <Badge
        badge={{ colours: 'orange-black', pattern: 'sash', shape: 'lozenge' }}
        code="VAL"
        name="Valencia"
        size="lg"
        labelled
      />
      <Badge
        badge={{ colours: 'white-blue', pattern: 'halves', shape: 'circle' }}
        code="VIT"
        name="Vitoria"
        size="lg"
        labelled
      />
    </OnScreen>
  ),
}
