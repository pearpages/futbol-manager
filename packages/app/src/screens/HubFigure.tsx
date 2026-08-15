import { FIGURES, type FigureKey } from './sprites.ts'
import '../styles/hub-figures.css'

/**
 * One pixel-art figure, at the foot of its quadrant.
 *
 * Modelled on `TileIcon.tsx` — inline SVG, the `viewBox` in the markup and the
 * size in CSS, geometry as a constant, and **no colour values in this file**.
 * Everything arrives through the custom properties in `styles/hub-figures.css`,
 * keyed on `data-figure`, which is the whole colour handoff.
 *
 * **`aria-hidden` is load-bearing, not politeness.** Two dozen assertions across
 * five test files find a hub tile by its exact accessible name, and
 * `openScreen('Fichar')` matches the whole string. A figure sits inside the
 * `<section>` rather than inside a `<button>`, so it could not rename a tile —
 * but it *would* land in the accessible name of anything that later wrapped it,
 * and it says nothing a screen reader wants in the first place. Same precedent
 * as `TileIcon` and the market's sort arrows.
 *
 * The runs are decoded once at module load in `sprites.ts`; this component only
 * reads them, because the hub re-renders on every tick of the day clock.
 */
export function HubFigure({ figure }: { readonly figure: FigureKey }) {
  const { width, height, runs } = FIGURES[figure]

  return (
    <svg
      className="hub-figure"
      data-figure={figure}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {runs.map(([ink, list]) => (
        <g key={ink} data-ink={ink}>
          {list.map((run) => (
            <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} />
          ))}
        </g>
      ))}
    </svg>
  )
}
