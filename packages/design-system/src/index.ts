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

export { Explain } from './components/Explain/Explain.tsx'
export { type FormPip, FormStrip } from './components/FormStrip/FormStrip.tsx'
export {
  type NoticeItem,
  NotificationList,
} from './components/NotificationList/NotificationList.tsx'
export { type PitchPlayer, PitchView } from './components/PitchView/PitchView.tsx'
export {
  laneX,
  PITCH_MARKINGS,
  PITCH_VIEWBOX,
  pitchSlots,
  type Position,
  SLOT_RADIUS,
} from './components/PitchView/pitch.ts'
export { PlayerLink } from './components/PlayerLink/PlayerLink.tsx'
export { type LanguageOption, SettingsMenu } from './components/SettingsMenu/SettingsMenu.tsx'
export { ShellCredit } from './components/ShellCredit/ShellCredit.tsx'
export { StadiumView } from './components/StadiumView/StadiumView.tsx'

// ── Primitives: React wrappers over chrome.css, rendering the same markup ──
export { AttrBar, type AttrBarProps } from './components/AttrBar/AttrBar.tsx'
export { Button, type ButtonProps } from './components/Button/Button.tsx'
export { Chip, type ChipProps } from './components/Chip/Chip.tsx'
export { ClubCell, type ClubCellProps } from './components/ClubCell/ClubCell.tsx'
export { DataTable, type DataTableProps } from './components/DataTable/DataTable.tsx'
export { Field, type FieldProps } from './components/Field/Field.tsx'
export { FieldLabel, type FieldLabelProps } from './components/FieldLabel/FieldLabel.tsx'
export { Hint, type HintProps } from './components/Hint/Hint.tsx'
export { NumberInput, type NumberInputProps } from './components/NumberInput/NumberInput.tsx'
export { Panel, type PanelProps } from './components/Panel/Panel.tsx'
export { Screen, type ScreenProps } from './components/Screen/Screen.tsx'
export {
  ScreenActions,
  type ScreenActionsProps,
} from './components/ScreenActions/ScreenActions.tsx'
export {
  ScreenHeading,
  type ScreenHeadingProps,
} from './components/ScreenHeading/ScreenHeading.tsx'
export { ScreenNote, type ScreenNoteProps } from './components/ScreenNote/ScreenNote.tsx'
export { Select, type SelectProps } from './components/Select/Select.tsx'
export { Slider, type SliderProps } from './components/Slider/Slider.tsx'
export { Stat, type StatProps } from './components/Stat/Stat.tsx'
export { StatLabel, type StatLabelProps } from './components/StatLabel/StatLabel.tsx'
export { StatValue, type StatValueProps } from './components/StatValue/StatValue.tsx'
export { Swatch, type SwatchProps } from './components/Swatch/Swatch.tsx'
export {
  VisuallyHidden,
  type VisuallyHiddenProps,
} from './components/VisuallyHidden/VisuallyHidden.tsx'
