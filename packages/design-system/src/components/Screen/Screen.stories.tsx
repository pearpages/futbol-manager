import type { Meta, StoryObj } from '@storybook/react'
import { OnPage } from '../../stories/Stage.tsx'
import { ScreenHeading } from '../ScreenHeading/ScreenHeading.tsx'
import { ScreenNote } from '../ScreenNote/ScreenNote.tsx'
import { Screen } from './Screen.tsx'

/** The recessed display every readout sits on. Ink on it is `screen-ink` and `screen-ink-soft`. */
const meta: Meta = { title: 'Primitives/Screen', component: Screen }
export default meta
type Story = StoryObj

export const WithHeadingAndNote: Story = {
  render: () => (
    <OnPage>
      <Screen>
        <ScreenHeading>Classificació</ScreenHeading>
        <ScreenNote>Jornada 3 de 38. El mercat tanca d’aquí a 7 dies.</ScreenNote>
      </Screen>
    </OnPage>
  ),
}
