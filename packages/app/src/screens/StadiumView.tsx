import { badgeFor } from './badges.ts'
import { PLAN_MODULES } from './stadium-plan.ts'
import { SECTION_MODULES } from './stadium-section.ts'
import { decodeAll, ghostDepth, type StadiumTier } from './stadium.ts'
import '../styles/stadium.css'

/**
 * The ground: what you have built, and what you could.
 *
 * Modelled on `TrophyIcon.tsx` — inline SVG, the `viewBox` in the markup and the
 * size in CSS, geometry as a constant, and **no colour values in this file**.
 * Everything arrives through the custom properties in `styles/stadium.css`.
 *
 * Two levels of `<g>`: the outer one is a module, which is what carries the
 * ghost, and the inner one is an ink. A trophy needs only the ink level because
 * a trophy is all one object; here the module level is the whole feature.
 *
 * **The seats take the club's own colours.** `badgeFor` already gives every club
 * a palette, so `data-colours` hands the stylesheet a `--badge-a` to derive from
 * and no new colour is invented. Thirteen palettes across twenty clubs, so some
 * grounds match — acceptable, since the tier drawing differs anyway.
 *
 * **`aria-hidden` is load-bearing, not politeness.** The capacity these drawings
 * describe is stated as a number a few centimetres away in the same panel, so
 * they have nothing to add and would only pollute whatever later wraps them. It
 * is also what keeps this clear of the assertions across the suite that resolve
 * a control by its exact accessible name. Same precedent as `TileIcon`,
 * `HubFigure` and `TrophyIcon` — and, being decoration, it is why the whole
 * feature needs no dictionary key in any of the three languages.
 */

const PLAN = decodeAll(PLAN_MODULES)
const SECTION = decodeAll(SECTION_MODULES)

function View({
  view,
  modules,
  tier,
  colours,
}: {
  readonly view: 'plan' | 'section'
  readonly modules: typeof PLAN
  readonly tier: StadiumTier
  readonly colours: string
}) {
  const { width, height } = modules[0] ?? { width: 0, height: 0 }

  return (
    <svg
      className={`stadium stadium--${view}`}
      data-colours={colours}
      data-tier={tier}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      aria-hidden="true"
    >
      {modules.map((module) => {
        const ghost = ghostDepth(module.tier, tier)
        return (
          <g
            key={module.key}
            data-module={module.key}
            {...(ghost === null ? {} : { 'data-ahead': ghost })}
          >
            {module.inks.map(({ ink, runs }) => (
              <g key={ink} data-ink={ink}>
                {runs.map((run) => (
                  <rect
                    key={`${String(run.x)}-${String(run.y)}`}
                    x={run.x}
                    y={run.y}
                    width={run.w}
                    height={1}
                  />
                ))}
              </g>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export function StadiumView({
  tier,
  clubId,
}: {
  readonly tier: StadiumTier
  readonly clubId: string
}) {
  const colours = badgeFor(clubId).colours

  return (
    <div className="stadium-pair">
      <View view="plan" modules={PLAN} tier={tier} colours={colours} />
      <View view="section" modules={SECTION} tier={tier} colours={colours} />
    </div>
  )
}
