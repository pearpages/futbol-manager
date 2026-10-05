import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { ScreenNote } from '../ScreenNote/ScreenNote.tsx'
import { VisuallyHidden } from './VisuallyHidden.tsx'

/** Words for a screen reader only. Nothing shows: the hidden text follows "Madrid". */
const meta: Meta = { title: 'Primitives/VisuallyHidden', component: VisuallyHidden }
export default meta
type Story = StoryObj

export const AfterAName: Story = {
  render: () => (
    <OnScreen>
      <ScreenNote>
        Madrid <VisuallyHidden>(el teu club)</VisuallyHidden>
      </ScreenNote>
    </OnScreen>
  ),
}
