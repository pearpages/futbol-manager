import type { Meta, StoryObj } from '@storybook/react'
import tokens from '../tokens.json'
import './foundations.css'
import './swatches.css'

/** The two families, the size scale, and the type groups the components use. */
const meta: Meta = { title: 'Foundations/Type' }
export default meta
type Story = StoryObj

const sizeToken = new Map(tokens.type.sizes.tokens.map((t) => [t.value, t.name]))

export const Scale: Story = {
  render: () => (
    <main className="foundation">
      <section className="foundation__group">
        <h2 className="foundation__title">Families</h2>
        {Object.entries(tokens.type.families).map(([name, stack]) => (
          <div key={name} className="foundation__item">
            <span />
            <div>
              <p className="foundation__name" data-token={name}>
                Classificació · Fes-te’n càrrec · 0123456789
              </p>
              <p className="foundation__meta">
                {name}: {stack}
              </p>
            </div>
          </div>
        ))}
      </section>
      <section className="foundation__group">
        <h2 className="foundation__title">Sizes</h2>
        {tokens.type.sizes.tokens.map((t) => (
          <div key={t.name} className="foundation__item">
            <span />
            <div>
              <p className="foundation__name" data-token={t.name}>
                Proper partit
              </p>
              <p className="foundation__meta">
                {t.name} · {t.value} · {t.usage}
              </p>
            </div>
          </div>
        ))}
      </section>
      <section className="foundation__group">
        <h2 className="foundation__title">Groups</h2>
        {tokens.type.groups.map((group) => (
          <div key={group.name} className="foundation__item">
            <span />
            <div>
              <p className="foundation__name">
                {group.name} <span className="foundation__meta">{group.family}</span>
              </p>
              {group.styles.map((style) => (
                <p
                  key={style.name}
                  className="foundation__meta"
                  data-token={sizeToken.get(style.fontSize)}
                >
                  {style.name} · {style.fontSize} · {style.fontWeight}
                </p>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  ),
}
