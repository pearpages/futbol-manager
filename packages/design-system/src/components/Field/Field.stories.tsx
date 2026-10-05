import type { Meta, StoryObj } from '@storybook/react'
import { OnScreen } from '../../stories/Stage.tsx'
import { FieldLabel } from '../FieldLabel/FieldLabel.tsx'
import { Hint } from '../Hint/Hint.tsx'
import { NumberInput } from '../NumberInput/NumberInput.tsx'
import { Select } from '../Select/Select.tsx'
import { Slider } from '../Slider/Slider.tsx'
import { Field } from './Field.tsx'

/** A labelled control on the screen material: number, select, slider, with a hint. */
const meta: Meta = { title: 'Primitives/Field', component: Field }
export default meta
type Story = StoryObj

export const Controls: Story = {
  render: () => (
    <OnScreen>
      <Field>
        <FieldLabel htmlFor="fee">Oferta (k€)</FieldLabel>
        <NumberInput id="fee" type="number" defaultValue={1200} />
      </Field>
      <Field>
        <FieldLabel htmlFor="compare">Compara amb</FieldLabel>
        <Select id="compare">
          <option>Ningú</option>
          <option>Courtois</option>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="approach">Plantejament</FieldLabel>
        <Slider id="approach" type="range" min={0} max={100} defaultValue={50} />
      </Field>
      <Hint>Forçar cap als extrems costa més del que dona.</Hint>
    </OnScreen>
  ),
}
