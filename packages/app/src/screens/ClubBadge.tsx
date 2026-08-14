import type { Club } from '@fm/domain'
import { type BadgePattern, type BadgeShape, badgeFor, needsNameplate } from './badges.ts'
import '../styles/club-badges.css'

/**
 * A club's badge: a shape, a shirt pattern, and the three-letter code.
 *
 * Drawn as inline SVG with classes only — no `style` prop, per the styling
 * convention. Every colour arrives through the custom properties set in
 * `club-badges.css`, so this file contains no colour values at all.
 *
 * The whole thing is a 100×100 viewBox scaled by a size class, which is what
 * lets one component serve an 18px table row and a 44px identity panel.
 */

/** Prefix for the shared clip paths in `<BadgeDefs />`. */
const CLIP = 'badge-shape-'

const SHAPES: Readonly<Record<BadgeShape, string>> = {
  // A rounded crest: square shoulders, a point at the bottom.
  shield: 'M12 8 H88 V56 Q88 82 50 94 Q12 82 12 56 Z',
  circle: 'M50 6 A44 44 0 1 1 49.9 6 Z',
  square: 'M14 10 H86 Q92 10 92 16 V84 Q92 90 86 90 H14 Q8 90 8 84 V16 Q8 10 14 10 Z',
  lozenge: 'M50 4 L94 50 L50 96 L6 50 Z',
  // A pennant: flat top, tapering to a point low and right.
  pennant: 'M14 8 H86 V60 L50 94 L14 60 Z',
}

/**
 * The pattern layer, clipped to the shape. Solid needs nothing — the field is
 * already the primary colour.
 */
function Pattern({ pattern }: { pattern: BadgePattern }) {
  switch (pattern) {
    case 'solid':
      return null

    case 'stripes':
      return (
        <g className="club-badge__mark">
          <rect x="20" y="0" width="12" height="100" />
          <rect x="44" y="0" width="12" height="100" />
          <rect x="68" y="0" width="12" height="100" />
        </g>
      )

    case 'hoops':
      return (
        <g className="club-badge__mark">
          <rect x="0" y="18" width="100" height="12" />
          <rect x="0" y="44" width="100" height="12" />
          <rect x="0" y="70" width="100" height="12" />
        </g>
      )

    case 'halves':
      return <rect className="club-badge__mark" x="50" y="0" width="50" height="100" />

    case 'sash':
      return <path className="club-badge__mark" d="M0 78 L78 0 H100 V22 L22 100 H0 Z" />
  }
}

/**
 * The five shapes, defined once for the whole document.
 *
 * Rendered at the app root rather than inside each badge. The market table shows
 * a couple of hundred rows, and a `<clipPath>` per badge meant the same five
 * outlines were defined a couple of hundred times — enough to push that screen's
 * tests past their timeout.
 */
export function BadgeDefs() {
  return (
    <svg className="visually-hidden" aria-hidden="true" width="0" height="0">
      <defs>
        {(Object.keys(SHAPES) as BadgeShape[]).map((shape) => (
          <clipPath key={shape} id={`${CLIP}${shape}`}>
            <path d={SHAPES[shape]} />
          </clipPath>
        ))}
      </defs>
    </svg>
  )
}

export interface ClubBadgeProps {
  readonly club: Club
  /** `sm` for table rows and lists, `lg` for the hub's identity panel. */
  readonly size?: 'sm' | 'lg'
  /**
   * Set when the club's name is *not* beside the badge. Where it is — a table
   * row, the market's club column — the badge is decoration and announcing it
   * again only makes a screen reader repeat itself.
   */
  readonly labelled?: boolean
}

export function ClubBadge({ club, size = 'sm', labelled = false }: ClubBadgeProps) {
  const badge = badgeFor(club.id)
  const clip = `url(#${CLIP}${badge.shape})`

  return (
    <svg
      className={`club-badge is-${size}`}
      viewBox="0 0 100 100"
      data-colours={badge.colours}
      data-shape={badge.shape}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? club.name : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <g clipPath={clip}>
        <rect className="club-badge__field" x="0" y="0" width="100" height="100" />
        <Pattern pattern={badge.pattern} />
        {/* Stripes and hoops otherwise run straight through the letters. */}
        {needsNameplate(badge.pattern) && (
          <rect className="club-badge__plate" x="0" y="36" width="100" height="30" />
        )}
        <text className="club-badge__code" x="50" y="62">
          {club.shortName}
        </text>
      </g>

      <path className="club-badge__outline" d={SHAPES[badge.shape]} />
    </svg>
  )
}
