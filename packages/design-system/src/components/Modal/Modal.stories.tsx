import type { Meta, StoryObj } from '@storybook/react'
import { OnPage } from '../../stories/Stage.tsx'
import { Button } from '../Button/Button.tsx'
import { NotificationList } from '../NotificationList/NotificationList.tsx'
import { ScreenActions } from '../ScreenActions/ScreenActions.tsx'
import { ScreenNote } from '../ScreenNote/ScreenNote.tsx'
import { Modal } from './Modal.tsx'

/**
 * A dialog: the title on the panel, the content on a recessed screen. On a phone
 * a plain one rises from the bottom as a sheet; `full` takes the whole screen,
 * with a × at the top and its last row of buttons pinned to the bottom.
 * Switch the viewport to Phone 390 to see both.
 */
const meta: Meta = { title: 'Components/Modal', component: Modal }
export default meta
type Story = StoryObj

export const Sheet: Story = {
  render: () => (
    <OnPage>
      <Modal title="Surt de la carrera" onClose={() => {}}>
        <ScreenNote>La carrera en curs es perd si no l’has desada.</ScreenNote>
        <ScreenActions>
          <Button type="button">Cancel·la</Button>
          <Button type="button" primary icon="exit">
            Surt de la carrera
          </Button>
        </ScreenActions>
      </Modal>
    </OnPage>
  ),
}

const NEWS = Array.from({ length: 14 }, (_, i) => ({
  key: String(i),
  tone: (['good', 'bad', 'plain'] as const)[i % 3] ?? 'plain',
  text:
    [
      'Victòria contra el Sevilla 2–1',
      'El Getafe ha rebutjat la teva oferta',
      'Queden 7 dies de mercat',
    ][i % 3] ?? '',
}))

export const Full: Story = {
  render: () => (
    <OnPage>
      <Modal title="Notícies" onClose={() => {}} full closeLabel="Tanca">
        <NotificationList notices={NEWS} empty="Encara no ha passat res." />
        <ScreenActions>
          <Button type="button" icon="close">
            Tanca
          </Button>
        </ScreenActions>
      </Modal>
    </OnPage>
  ),
}
