import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '../Button/Button.tsx'
import { OnPage } from '../../stories/Stage.tsx'
import { Panel } from './Panel.tsx'

/** The hardware surface: bars, footers, menus, dialogs. Ink on it is `ink` and `ink-soft`. */
const meta: Meta = { title: 'Primitives/Panel', component: Panel }
export default meta
type Story = StoryObj

export const AFooter: Story = {
  render: () => (
    <OnPage>
      <Panel as="footer" className="preview-row">
        <Button type="button" icon="back">
          Torna
        </Button>
        <Button type="button" icon="save">
          Desada ràpida
        </Button>
        <Button type="button" primary icon="step">
          Avança un dia
        </Button>
      </Panel>
    </OnPage>
  ),
}
