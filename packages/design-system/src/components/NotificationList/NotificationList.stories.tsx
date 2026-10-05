import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { NotificationList } from './NotificationList.tsx'

/** The news, one line each, toned good, bad or plain. */
const meta: Meta = { title: 'Components/NotificationList', component: NotificationList }
export default meta
type Story = StoryObj

export const News: Story = {
  render: () => (
    <OnScreen>
      <NotificationList
        empty="Encara no ha passat res."
        notices={[
          { key: '1', tone: 'good', text: 'Has guanyat el Sevilla per 2 a 1.' },
          { key: '2', tone: 'bad', text: 'El Getafe ha rebutjat la teva oferta.' },
          { key: '3', tone: 'plain', text: 'El mercat tanca d’aquí a 7 dies.' },
        ]}
      />
    </OnScreen>
  ),
}

export const Empty: Story = {
  render: () => (
    <OnScreen>
      <NotificationList empty="Encara no ha passat res." notices={[]} />
    </OnScreen>
  ),
}
