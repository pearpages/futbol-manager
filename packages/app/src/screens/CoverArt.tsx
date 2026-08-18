import { COVER } from './cover.ts'
import '../styles/cover.css'

/**
 * The landing page's cover.
 *
 * Geometry in `cover.ts`, colour in `styles/cover.css` — the split `badges.ts`,
 * `radar.ts`, `sprites.ts` and `stadium.ts` all use, and the one a test enforces
 * by refusing a hex literal in either of this pair.
 *
 * One `<g data-ink>` level, no parts: nothing here animates. Size lives in CSS,
 * and the aspect ratio comes off the viewBox, so there is no `height` attribute
 * to keep in step with it.
 *
 * `aria-hidden`, like every other drawing in this app. The landing carries the
 * game's name as a real heading; the lettering in the picture is the same name
 * said a second time, and announcing it twice is worse than not announcing the
 * decoration at all.
 */
export function CoverArt(): React.JSX.Element {
  return (
    <svg
      className="cover"
      viewBox={`0 0 ${COVER.width} ${COVER.height}`}
      role="presentation"
      aria-hidden="true"
    >
      {COVER.inks.map(({ ink, runs }) => (
        <g key={ink} data-ink={ink}>
          {runs.map((run) => (
            <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} />
          ))}
        </g>
      ))}
    </svg>
  )
}
