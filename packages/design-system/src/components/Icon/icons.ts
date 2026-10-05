/**
 * The interface glyphs: navigation and actions, as opposed to the hub's tile
 * pictures (`TileIcon`).
 *
 * One path each on a 24-unit grid, filled with `evenodd` so a cut-out is just a
 * second subpath. Geometry only (P17): colour is `currentColor` from the CSS.
 * Blunt shapes on purpose — they are drawn at 20px, and on a phone that is the
 * whole of what tells a tab from its neighbour.
 */
export const ICON_PATHS = {
  // A house: the day's summary, where the game starts and returns.
  home: 'M12 3 2 11h3v10h5v-6h4v6h5V11h3z',
  // A shirt: the team you pick.
  shirt: 'M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3c-.5 1.7-2 3-4 3S8.5 4.7 8 3z',
  // Two arrows passing: players moving between clubs.
  transfer: 'M16 3l5 4-5 4V8H4V6h12z M8 13l-5 4 5 4v-3h12v-2H8z',
  // A podium: the league, read by who stands highest.
  league: 'M9 6h6v15H9z M2 11h6v10H2z M16 14h6v7h-6z',
  // A shield in outline: the club as an institution — money, board, ground.
  club: 'M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z M12 4.6l6 2.3V11c0 4-2.5 7.6-6 9.1-3.5-1.5-6-5.1-6-9.1V6.9z',
  // Three square dots: everything else.
  more: 'M4 10h4v4H4z M10 10h4v4h-4z M16 10h4v4h-4z',
  back: 'M15 3 6 12l9 9 2-2-7-7 7-7z',
  play: 'M7 4v16l13-8z',
  // Two plays and a bar: skip ahead to the next stop.
  skip: 'M3 5v14l8-7z M11 5v14l8-7z M19 5h2v14h-2z',
  // A floppy disk, which is what saving looked like when this genre was young.
  save: 'M3 3h15l3 3v15H3z M6 5v5h10V5z M7 14h10v6H7z',
  filter: 'M3 4h18l-7 8v7l-4 2v-9z',
  search:
    'M10 3a7 7 0 1 0 4.2 12.6l5.1 5.1 1.4-1.4-5.1-5.1A7 7 0 0 0 10 3z M10 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  close: 'M5 3.6 3.6 5l7 7-7 7L5 20.4l7-7 7 7 1.4-1.4-7-7 7-7L19 3.6l-7 7z',
  undo: 'M8 4 2 9l6 5v-3.5h6a4 4 0 0 1 0 8H9v2h5a6 6 0 0 0 0-12H8z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  chevron: 'M9 3 7 5l7 7-7 7 2 2 9-9z',
} as const

export type IconName = keyof typeof ICON_PATHS

export const ICON_NAMES = Object.keys(ICON_PATHS) as readonly IconName[]
