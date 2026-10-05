import type { Meta, StoryObj } from '@storybook/react'
import tokens from '../tokens.json'
import { contrast } from './contrast.ts'
import './foundations.css'
import './swatches.css'

/**
 * Every colour token, read from `tokens.json`, with its usage. Grouped by what
 * it is for; then every ink on the surfaces it is allowed on, with its WCAG
 * contrast. A pair below 4.5:1 is a defect (ADR 0021).
 */
const meta: Meta = { title: 'Foundations/Colour' }
export default meta
type Story = StoryObj

const GROUPS: readonly (readonly [string, readonly string[]])[] = [
  [
    'Surfaces',
    [
      'panel',
      'panel-raised',
      'bevel-light',
      'bevel-dark',
      'screen',
      'screen-raised',
      'screen-rule',
      'void',
      'scrim',
    ],
  ],
  ['Inks', ['ink', 'ink-soft', 'screen-ink', 'screen-ink-soft', 'highlight']],
  ['Accent', ['accent', 'accent-hover', 'accent-ink', 'accent-wash']],
  [
    'Bands and their inks',
    [
      'champion',
      'ucl',
      'ucl-ink',
      'uel',
      'uecl',
      'relegation',
      'relegation-ink',
      'relegation-tint',
      'relegation-hover',
      'chip-fw',
    ],
  ],
  ['Roles', ['win', 'draw', 'loss', 'series-a', 'series-b']],
  ['Overlays', ['overlay-1', 'overlay-2', 'overlay-3']],
]

/** Which ink may sit on which surface. */
const PAIRS: readonly (readonly [string, string])[] = [
  ['ink', 'panel'],
  ['ink-soft', 'panel'],
  ['ink-soft', 'panel-raised'],
  ['screen-ink', 'screen'],
  ['screen-ink-soft', 'screen'],
  ['screen-ink-soft', 'screen-raised'],
  ['relegation-ink', 'screen'],
  ['relegation-tint', 'screen'],
  ['ucl-ink', 'screen'],
  ['win', 'screen'],
  ['accent', 'screen'],
  ['accent-ink', 'accent'],
  ['highlight', 'screen'],
]

const byName = new Map(tokens.color.tokens.map((t) => [t.name, t]))
const listed = new Set(GROUPS.flatMap(([, names]) => names))
const others = tokens.color.tokens.map((t) => t.name).filter((n) => !listed.has(n))

function Swatches({ title, names }: { readonly title: string; readonly names: readonly string[] }) {
  return (
    <section className="foundation__group">
      <h2 className="foundation__title">{title}</h2>
      <div className="foundation__grid">
        {names.map((name) => {
          const token = byName.get(name)
          if (token === undefined) return null
          return (
            <div key={name} className="foundation__item">
              <span className="foundation__swatch" data-token={name} />
              <div>
                <p className="foundation__name">
                  {name} <span className="foundation__meta">{token.value}</span>
                </p>
                <p className="foundation__meta">{token.usage}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export const Tokens: Story = {
  render: () => (
    <main className="foundation">
      {GROUPS.map(([title, names]) => (
        <Swatches key={title} title={title} names={names} />
      ))}
      {others.length > 0 && <Swatches title="Other" names={others} />}
    </main>
  ),
}

export const Contrast: Story = {
  render: () => (
    <main className="foundation">
      <section className="foundation__group">
        <h2 className="foundation__title">Ink on its surfaces</h2>
        {PAIRS.map(([ink, surface]) => {
          const ratio = contrast(
            byName.get(ink)?.value ?? '#000',
            byName.get(surface)?.value ?? '#000',
          )
          return (
            <p
              key={`${ink}-${surface}`}
              className="foundation__sample"
              data-token={surface}
              data-ink={ink}
            >
              <span>
                {ink} on {surface}
              </span>
              <span>
                {ratio.toFixed(2)}:1 {ratio >= 4.5 ? 'AA' : 'below AA'}
              </span>
            </p>
          )
        })}
      </section>
    </main>
  ),
}
