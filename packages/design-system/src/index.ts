/**
 * `@fm/design-system`: the game's tokens, primitives and shared components.
 *
 * Two consumers (ADR 0014): the app imports this entry from source, and the
 * Claude Design System artifact loads `dist/bundle.js`, built from `bundle.ts`.
 * The stylesheets are separate exports: `tokens.css`, `reset.css` and
 * `chrome.css`, loaded once by the app in that order.
 *
 * Nothing here holds a string the player reads. Every label arrives as a prop,
 * so translation stays in the app (P16).
 */

export { AttributeRadar } from './components/AttributeRadar/AttributeRadar.tsx'
export { Badge, BadgeDefs, type BadgeProps } from './components/Badge/Badge.tsx'
export {
  type Badge as BadgeSpec,
  type BadgeColours,
  type BadgePattern,
  type BadgeShape,
  COLOUR_KEYS,
  needsNameplate,
} from './components/Badge/badges.ts'
export { HubFigure } from './components/HubFigure/HubFigure.tsx'
export { Modal } from './components/Modal/Modal.tsx'
export { Pager } from './components/Pager/Pager.tsx'
export { SortHeader } from './components/SortHeader/SortHeader.tsx'
export { nextSort, type Sort, sortedBy } from './components/SortHeader/sorting.ts'
export { ICON_KEYS, type IconKey, TileIcon } from './components/TileIcon/TileIcon.tsx'
export { TrophyIcon } from './components/TrophyIcon/TrophyIcon.tsx'
