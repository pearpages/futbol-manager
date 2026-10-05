import type { Meta, StoryObj } from '@storybook/react'
import { OnPage } from '../../stories/Stage.tsx'
import { ShellCredit } from './ShellCredit.tsx'

/** Under the hardware: who made it, and which build this is. */
const meta: Meta = { title: 'Components/ShellCredit', component: ShellCredit }
export default meta
type Story = StoryObj

export const Credit: Story = {
  render: () => (
    <OnPage>
      <ShellCredit
        madeBy="Fet per"
        buildLabel="Compilació"
        commit="v0.7.0"
        iconSrc="/pearpages-icon.png"
      />
    </OnPage>
  ),
}
