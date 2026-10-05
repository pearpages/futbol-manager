import type { Meta, StoryObj } from '@storybook/react'
import tokens from '../tokens.json'
import './foundations.css'
import './swatches.css'

/** The spacing scale, the three radii and the one shadow. Hardware is square. */
const meta: Meta = { title: 'Foundations/Space and radius' }
export default meta
type Story = StoryObj

export const Scale: Story = {
  render: () => (
    <main className="foundation">
      <section className="foundation__group">
        <h2 className="foundation__title">Spacing</h2>
        {tokens.spacing.tokens.map((t) => (
          <div key={t.name} className="foundation__item">
            <span className="foundation__bar" data-token={t.name} />
            <p className="foundation__meta">
              {t.name} · {t.value} · {t.usage}
            </p>
          </div>
        ))}
      </section>
      <section className="foundation__group">
        <h2 className="foundation__title">Radius and shadow</h2>
        {[...tokens.radius.tokens, ...tokens.shadow.tokens].map((t) => (
          <div key={t.name} className="foundation__item">
            <span className="foundation__box" data-token={t.name} />
            <p className="foundation__meta">
              {t.name} · {t.value} · {t.usage}
            </p>
          </div>
        ))}
      </section>
    </main>
  ),
}
