import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { ScreenHeading } from '../ScreenHeading/ScreenHeading.tsx'
import { Explain } from './Explain.tsx'

/** The "i" beside a heading: how to read what is under it. Press it. */
const meta: Meta = { title: 'Components/Explain', component: Explain }
export default meta
type Story = StoryObj

export const BesideAHeading: Story = {
  render: () => (
    <OnScreen>
      <ScreenHeading>
        Plantilla{' '}
        <Explain
          label="Explica: com llegir aquesta taula"
          title="Com llegir aquesta taula"
          paragraphs={[
            'Un sol número que resumeix vuit atributs, ponderats segons la posició que ocupa.',
            'El sou és el que et costa tota una temporada, pagat a terminis cada mes.',
          ]}
          closeLabel="Tanca"
        />
      </ScreenHeading>
    </OnScreen>
  ),
}
