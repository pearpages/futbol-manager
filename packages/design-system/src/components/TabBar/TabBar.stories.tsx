import type { Meta, StoryObj } from '@storybook/react'
import { OnPage } from '../../stories/Stage.tsx'
import { TabBar } from './TabBar.tsx'

/** The phone's five places, at the bottom. A count waits on the market. */
const meta: Meta = { title: 'Components/TabBar', component: TabBar }
export default meta
type Story = StoryObj

export const Places: Story = {
  render: () => (
    <OnPage>
      <TabBar
        label="Seccions"
        items={[
          { value: 'today', label: 'Avui', icon: 'home' },
          { value: 'team', label: 'Equip', icon: 'shirt' },
          { value: 'market', label: 'Mercat', icon: 'transfer', badge: 2, badgeLabel: 'noves' },
          { value: 'league', label: 'Lliga', icon: 'league' },
          { value: 'club', label: 'Club', icon: 'club' },
        ]}
        value="today"
        onChange={() => {}}
      />
    </OnPage>
  ),
}
