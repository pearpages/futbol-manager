import { TROPHIES, type TrophyKey } from './trophies.ts'
import '../styles/trophies.css'

/**
 * One trophy.
 *
 * Modelled on `HubFigure.tsx` — inline SVG, the `viewBox` in the markup and the
 * size in CSS, geometry as a constant, and **no colour values in this file**.
 * Everything arrives through the custom properties in `styles/trophies.css`, keyed
 * on `data-trophy`.
 *
 * One level of `<g>` rather than two: a figure needs `data-part` so the hub can
 * animate a prop without dragging a necktie along, and a trophy has no moving
 * pieces.
 *
 * **`aria-hidden` is load-bearing, not politeness.** Dozens of assertions across
 * the suite resolve a control by its exact accessible name, and this sits inside
 * the honours panel beside the competition's name in real text — so the graphic
 * has nothing to add and would only pollute whatever later wraps it. Same
 * precedent as `TileIcon`, `HubFigure` and the market's sort arrows.
 *
 * `empty` dims a competition nobody has won yet rather than hiding it, so the
 * palmarés shows the shape of what is winnable from the first day of a career.
 */
export function TrophyIcon({
  trophy,
  empty = false,
}: {
  readonly trophy: TrophyKey
  readonly empty?: boolean
}) {
  const { width, height, inks } = TROPHIES[trophy]

  return (
    <svg
      className={`trophy${empty ? ' is-empty' : ''}`}
      data-trophy={trophy}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {inks.map(({ ink, runs }) => (
        <g key={ink} data-ink={ink}>
          {runs.map((run) => (
            <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} />
          ))}
        </g>
      ))}
    </svg>
  )
}
