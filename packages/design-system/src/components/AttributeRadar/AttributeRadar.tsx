import {
  labelAt,
  nodeAt,
  polygonPoints,
  RADAR_RINGS,
  RADAR_VIEWBOX,
  ringPoints,
  spokes,
} from './radar.ts'
import './AttributeRadar.css'

/**
 * The eight attributes as a shape.
 *
 * A bar chart is a list; a polygon has a silhouette, which is the whole reason
 * every current football game draws one. The second reason is comparison: two
 * players on one set of axes is the cheapest read there is, and it is why this is
 * a radar rather than a pizza — wedges cannot overlay.
 *
 * Inline SVG with classes only, no `style` prop, and **no colour value in this
 * file** — everything arrives through the custom properties in `AttributeRadar.css`,
 * the same arrangement `Badge` uses.
 */

export interface AttributeRadarProps {
  /** The subject's eight values, in axis order. */
  readonly values: readonly number[]
  /** A second player's eight values, drawn as an outline over the first. */
  readonly compare?: readonly number[] | undefined
  /** Short axis names — the full ones do not fit an octagon at this size. */
  readonly labels: readonly string[]
  /** The accessible name. The bars beside the chart carry the numbers. */
  readonly title: string
}

export function AttributeRadar({ values, compare, labels, title }: AttributeRadarProps) {
  return (
    <svg className="radar" viewBox={RADAR_VIEWBOX} role="img" aria-label={title}>
      <g className="radar__grid">
        {RADAR_RINGS.map((fraction) => (
          <polygon key={fraction} className="radar__ring" points={ringPoints(fraction)} />
        ))}
        {spokes().map((spoke, i) => (
          <line
            key={labels[i] ?? i}
            className="radar__spoke"
            x1={spoke.x1}
            y1={spoke.y1}
            x2={spoke.x2}
            y2={spoke.y2}
          />
        ))}
      </g>

      {/* The comparison sits *under* the subject: whoever's card this is stays the
          one you read first. */}
      {compare !== undefined && (
        <polygon className="radar__area is-compare" points={polygonPoints(compare)} />
      )}
      <polygon className="radar__area" points={polygonPoints(values)} />

      {values.map((value, i) => {
        const node = nodeAt(value, i)
        return (
          <circle key={labels[i] ?? i} className="radar__node" cx={node.x} cy={node.y} r={1.6} />
        )
      })}

      {labels.map((label, i) => {
        const position = labelAt(i)
        return (
          <text
            key={label}
            className="radar__label"
            x={position.x}
            y={position.y}
            textAnchor={position.anchor}
            dominantBaseline="middle"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}
