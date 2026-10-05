import type { Meta, StoryObj } from '@storybook/react'
import { OnPanel, OnScreen } from '../../stories/Stage.tsx'
import { Button } from './Button.tsx'

/** The bevelled hardware button: default, primary (the one action asked for), with a verb's glyph, disabled. */
const meta: Meta = { title: 'Primitives/Button', component: Button }
export default meta
type Story = StoryObj

export const Variants: Story = {
  render: () => (
    <OnPanel>
      <Button type="button">Torna</Button>
      <Button type="button" primary>
        Avança un dia
      </Button>
      <Button type="button" icon="save">
        Desada ràpida
      </Button>
      <Button type="button" primary icon="cash">
        Ofereix
      </Button>
      <Button type="button" disabled>
        Planter
      </Button>
    </OnPanel>
  ),
}

/** Buttons are hardware, so they read the same on the screen material. */
export const OnTheScreen: Story = {
  render: () => (
    <OnScreen row>
      <Button type="button" icon="star">
        Segueix
      </Button>
      <Button type="button" primary icon="cash">
        Ofereix
      </Button>
      <Button type="button" icon="tag">
        Ven
      </Button>
    </OnScreen>
  ),
}

export const Playground: Story = {
  args: { type: 'button', children: 'Comença les obres', primary: true, icon: 'build' },
  render: (args) => (
    <OnPanel>
      <Button {...args} />
    </OnPanel>
  ),
}
