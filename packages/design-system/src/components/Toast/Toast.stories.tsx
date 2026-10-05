import type { Meta, StoryObj } from '@storybook/react'
import { OnPage } from '../../stories/Stage.tsx'
import { Toast } from './Toast.tsx'

/** Something just happened, and can be taken back for a few seconds. */
const meta: Meta = { title: 'Components/Toast', component: Toast }
export default meta
type Story = StoryObj

export const WithUndo: Story = {
  render: () => (
    <OnPage>
      <Toast
        message="Onze refet en 4-3-3"
        actionLabel="Desfés"
        onAction={() => {}}
        onDismiss={() => {}}
        duration={1e9}
      />
    </OnPage>
  ),
}
