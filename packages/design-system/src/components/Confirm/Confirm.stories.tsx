import type { Meta, StoryObj } from '@storybook/react'
import { OnPage } from '../../stories/Stage.tsx'
import { Confirm } from './Confirm.tsx'

/** Before anything that cannot be undone: what it costs, what is left, cancel first. */
const meta: Meta = { title: 'Components/Confirm', component: Confirm }
export default meta
type Story = StoryObj

export const Signing: Story = {
  render: () => (
    <OnPage>
      <Confirm
        title="Fitxar Denzel Domfries?"
        confirmLabel="Fitxa’l"
        confirmIcon="sign"
        cancelLabel="Cancel·la"
        onConfirm={() => {}}
        onCancel={() => {}}
      >
        <p>Contracte de 3 temporades a 600 k€ l’any.</p>
        <p>Pagues 3,4 M€ ara, prima de fitxatge inclosa.</p>
        <p>Et quedaran 18,6 M€ de pressupost.</p>
      </Confirm>
    </OnPage>
  ),
}
