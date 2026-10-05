import type { Meta, StoryObj } from '@storybook/react'
import { Icon } from '../components/Icon/Icon.tsx'
import { ICON_NAMES } from '../components/Icon/icons.ts'
import { ICON_KEYS, TileIcon } from '../components/TileIcon/TileIcon.tsx'
import './foundations.css'

/**
 * The interface glyphs (`Icon`: verbs and navigation) and the place pictures
 * (`TileIcon`: the hub's tiles, and a phone tab's segments). Drawn in code,
 * coloured by CSS (P17).
 */
const meta: Meta = { title: 'Foundations/Icons' }
export default meta
type Story = StoryObj

export const All: Story = {
  render: () => (
    <main className="foundation">
      <section className="foundation__group">
        <h2 className="foundation__title">Glyphs</h2>
        <div className="foundation__icons">
          {ICON_NAMES.map((name) => (
            <span key={name} className="foundation__icon">
              <Icon name={name} />
              {name}
            </span>
          ))}
        </div>
      </section>
      <section className="foundation__group">
        <h2 className="foundation__title">Places</h2>
        <div className="foundation__icons">
          {ICON_KEYS.map((key) => (
            <span key={key} className="foundation__icon">
              <TileIcon icon={key} />
              {key}
            </span>
          ))}
        </div>
      </section>
    </main>
  ),
}
