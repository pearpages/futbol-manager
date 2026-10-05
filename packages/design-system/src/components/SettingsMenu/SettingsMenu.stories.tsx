import type { Meta, StoryObj } from '@storybook/react'
import { OnPanel } from '../../stories/Stage.tsx'
import { SettingsMenu } from './SettingsMenu.tsx'

/** The language in use, as its code; the menu names each language in itself. */
const meta: Meta = { title: 'Components/SettingsMenu', component: SettingsMenu }
export default meta
type Story = StoryObj

export const Language: Story = {
  render: () => (
    <OnPanel>
      <SettingsMenu
        languageLabel="Idioma"
        languages={[
          { value: 'ca', name: 'Català' },
          { value: 'es', name: 'Español' },
          { value: 'en', name: 'English' },
        ]}
        current="ca"
        onChange={() => {}}
      />
    </OnPanel>
  ),
}
