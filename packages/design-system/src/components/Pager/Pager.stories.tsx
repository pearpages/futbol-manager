import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { Pager } from './Pager.tsx'

/** Back and forth through rounds or pages. */
const meta: Meta = { title: 'Components/Pager', component: Pager }
export default meta
type Story = StoryObj

export const Rounds: Story = {
  render: () => (
    <OnScreen>
      <Pager
        prevLabel="Jornada anterior"
        nextLabel="Jornada següent"
        atStart={false}
        atEnd={false}
        onPrev={() => {}}
        onNext={() => {}}
      >
        <span className="pager__label">Jornada 3</span>
      </Pager>
    </OnScreen>
  ),
}
