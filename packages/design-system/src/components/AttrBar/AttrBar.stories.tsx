import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { AttrBar } from './AttrBar.tsx'

/** One attribute as a bar, as the ficha lists all eight. */
const meta: Meta = { title: 'Primitives/AttrBar', component: AttrBar }
export default meta
type Story = StoryObj

export const Attribute: Story = {
  render: () => (
    <OnScreen>
      <AttrBar>
        <span className="attr__label">Porteria</span>
        <span className="attr__track">
          <span className="attr__fill is-strong" data-fill="17" />
        </span>
        <span className="attr__value">87</span>
      </AttrBar>
      <AttrBar>
        <span className="attr__label">Velocitat</span>
        <span className="attr__track">
          <span className="attr__fill" data-fill="12" />
        </span>
        <span className="attr__value">76</span>
      </AttrBar>
    </OnScreen>
  ),
}
