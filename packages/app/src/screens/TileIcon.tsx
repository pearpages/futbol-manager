/**
 * The hub's tile icons.
 *
 * PC Fútbol put a little rendered illustration beside every entry on the Menu
 * Manager — a television, a calendar, a safe, a stadium — and that is most of
 * why its hub reads at a glance rather than as twelve words. We take the idea
 * and not the art: ADR 0007 puts their icons and artwork squarely on the
 * protected side of the line, so these are drawn here, flat.
 *
 * Modelled on `ClubBadge.tsx` — inline SVG, a `viewBox` scaled by a class,
 * geometry as a constant, and **no colour values in this file**. Everything is
 * `currentColor`, so an icon takes the tile's own text colour and inherits the
 * disabled treatment (`--fm-ink-soft` at 0.55 opacity) for nothing.
 *
 * **Every icon is `aria-hidden`, and that is load-bearing.** Two dozen
 * assertions across five test files find a tile by its exact accessible name —
 * `openScreen('Fichar')` matches the whole string — so an icon that contributed
 * any text would rename every tile and take the suite down with it. The sort
 * arrows in `MarketScreen.tsx` set the same precedent.
 */

export type IconKey =
  | 'table'
  | 'results'
  | 'calendar'
  | 'pitch'
  | 'tactics'
  | 'scout'
  | 'contract'
  | 'roster'
  | 'youth'
  | 'safe'
  | 'scales'
  | 'stadium'

/**
 * One entry per tile. Kept deliberately blunt — three or four primitives each,
 * because the drawing is 18px on screen and detail below that is noise.
 */
const ICONS: Readonly<Record<IconKey, React.JSX.Element>> = {
  // Ranked bars: a classification is read top-down by length.
  table: (
    <g>
      <rect x="3" y="4" width="18" height="3" />
      <rect x="3" y="10" width="13" height="3" />
      <rect x="3" y="16" width="8" height="3" />
    </g>
  ),

  // A scoreboard: two figure blocks either side of a dash.
  results: (
    <g>
      <path d="M2 4h20v14H2z M4 6v10h16V6z" fillRule="evenodd" />
      <rect x="6" y="9" width="4" height="4" />
      <rect x="11" y="10" width="2" height="2" />
      <rect x="14" y="9" width="4" height="4" />
    </g>
  ),

  // A wall calendar, hangers and all.
  calendar: (
    <g>
      <rect x="6" y="1" width="2" height="4" />
      <rect x="16" y="1" width="2" height="4" />
      <path d="M2 3h20v19H2z M4 9v11h16V9z" fillRule="evenodd" />
      <rect x="6" y="11" width="3" height="3" />
      <rect x="11" y="11" width="3" height="3" />
      <rect x="16" y="11" width="3" height="3" />
      <rect x="6" y="16" width="3" height="3" />
      <rect x="11" y="16" width="3" height="3" />
    </g>
  ),

  // A pitch with a shape on it — halfway line, centre circle, three men.
  pitch: (
    <g>
      <path d="M2 3h20v18H2z M4 5v14h16V5z" fillRule="evenodd" />
      <rect x="4" y="11.25" width="16" height="1.5" />
      <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
      <circle cx="7" cy="8" r="1.6" />
      <circle cx="17" cy="8" r="1.6" />
      <circle cx="12" cy="18" r="1.6" />
    </g>
  ),

  // A coach's board: a clipboard with a run of play drawn on it.
  tactics: (
    <g>
      <path d="M9 1h6v3H9z" />
      <path d="M4 3h4v3h8V3h4v19H4z M6 5v15h12V5h-2v3H8V5z" fillRule="evenodd" />
      <path d="M7 17.5c2-5 5-5 7-2l1.4-1.6.9 4.4-4.3-1 1.3-1.4c-1.5-2.1-3.4-2-4.9 2z" />
    </g>
  ),

  // Ver rival: a magnifier over the opposition.
  scout: (
    <g>
      <path d="M10.5 2a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 2.2a6.3 6.3 0 1 0 0 12.6 6.3 6.3 0 0 0 0-12.6z" />
      <path d="M16.6 16.6 22 22l-1.6 1.6-5.4-5.4z" />
      <rect x="7" y="8.5" width="7" height="1.6" />
      <rect x="7" y="11.6" width="4.5" height="1.6" />
    </g>
  ),

  // A contract, signed: ruled paper and a nib crossing it.
  contract: (
    <g>
      <path d="M4 1h11l5 5v6h-2V8h-5V3H6v18h6v2H4z" />
      <rect x="7" y="8" width="6" height="1.5" />
      <rect x="7" y="11.5" width="6" height="1.5" />
      <path d="m20.4 12.6 1.9 1.9-7 7-2.7.8.8-2.7z" />
    </g>
  ),

  // A roster: three of them, one in front.
  roster: (
    <g>
      <path d="M12 4a3.2 3.2 0 1 1 0 6.4A3.2 3.2 0 0 1 12 4zM6.5 21v-2.4c0-2.6 2.5-4.2 5.5-4.2s5.5 1.6 5.5 4.2V21z" />
      <path d="M5 6.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM.5 21v-2c0-1.7 1.2-3 3-3.5-1 1-1.5 2.2-1.5 3.6V21z" />
      <path d="M19 6.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zm4.5 14.5h-1.5v-1.9c0-1.4-.5-2.6-1.5-3.6 1.8.5 3 1.8 3 3.5z" />
    </g>
  ),

  // The academy: something small, growing.
  youth: (
    <g>
      <rect x="11" y="11" width="2" height="10" />
      <path d="M11 13C11 9 8 6.5 3.5 6.5c0 4 2.8 6.5 7.5 6.5z" />
      <path d="M13 11.5c0-4 3-6.5 7.5-6.5 0 4-2.8 6.5-7.5 6.5z" />
      <path d="M6 21h12v2H6z" />
    </g>
  ),

  // Caja: a strongbox with a dial.
  safe: (
    <g>
      <path d="M2 3h20v16H2z M4 5v12h16V5z" fillRule="evenodd" />
      <path d="M11 7.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zm0 1.8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
      <rect x="16" y="8" width="2" height="6" />
      <rect x="4" y="19" width="3" height="3" />
      <rect x="17" y="19" width="3" height="3" />
    </g>
  ),

  // Decisiones: the scales, because a board decision is a trade.
  scales: (
    <g>
      <rect x="11" y="3" width="2" height="17" />
      <rect x="6" y="20" width="12" height="2" />
      <rect x="4" y="5" width="16" height="1.8" />
      <path d="M4 7 1 13.5h6zM20 7l-3 6.5h6z" />
      <circle cx="12" cy="3" r="1.8" />
    </g>
  ),

  // The ground: a bowl, and the pitch inside it.
  stadium: (
    <g>
      <path d="M12 4c6.1 0 11 2.2 11 5v6c0 2.8-4.9 5-11 5S1 17.8 1 15V9c0-2.8 4.9-5 11-5zm0 2C6.9 6 3 7.7 3 9s3.9 3 9 3 9-1.7 9-3-3.9-3-9-3z" />
      <path d="M12 13.2c-3.5 0-6.4-.8-8-2v3.5c0 1.1 3.4 2.6 8 2.6s8-1.5 8-2.6v-3.5c-1.6 1.2-4.5 2-8 2z" />
    </g>
  ),
}

export const ICON_KEYS = Object.keys(ICONS) as readonly IconKey[]

export function TileIcon({ icon }: { readonly icon: IconKey }) {
  return (
    <svg className="tile-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[icon]}
    </svg>
  )
}
