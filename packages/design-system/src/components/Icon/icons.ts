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
  // Two disks, one behind the other: the saves, as a set of the floppy above.
  saves: 'M7 2h11l3 3v11h-2V6l-2-2H7z M3 7h11l3 3v11H3z M5 9v3h7V9z M6 15h8v4H6z',
  // A door and an arrow leaving through it.
  exit: 'M4 3h10v6h-2V5H6v14h6v-4h2v6H4z M15 8l5 4-5 4v-3H9v-2h6z',
  // A folded newspaper: three lines of copy and the back page's edge.
  news: 'M3 4h15v15a1 1 0 0 0 2 0V8h2v11a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2z M6 7v4h9V7z M6 13v2h9v-2z M6 17v2h9v-2z',
  // One play and a bar: a single step on, the day.
  step: 'M5 5v14l11-7z M17 5h2v14h-2z',
  plus: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z',
  // Following a player: the outline, and filled once followed.
  star: 'M12.0 2.0 14.9 8.6 22.0 9.2 16.6 13.9 18.2 21.0 12.0 17.3 5.8 21.0 7.4 13.9 2.0 9.2 9.1 8.6z M12.0 7.2 13.4 10.5 17.0 10.8 14.3 13.2 15.1 16.7 12.0 14.9 8.9 16.7 9.7 13.2 7.0 10.8 10.6 10.5z',
  'star-filled':
    'M12.0 2.0 14.9 8.6 22.0 9.2 16.6 13.9 18.2 21.0 12.0 17.3 5.8 21.0 7.4 13.9 2.0 9.2 9.1 8.6z',
  // A banknote: money offered, a bid. (A coin read as a circled "i" at 18px.)
  cash: 'M2 6h20v12H2z M4 8v8h16V8z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  // A sheet and a pen: terms, a contract, a renewal.
  sign: 'M4 3h10l4 4v5h-2V8h-3V5H6v14h5v2H4z M19.5 12.5l2 2-6.5 6.5H13v-2z',
  // A price tag: up for sale.
  tag: 'M3 3h8l10 10-8 8L3 11z M7 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  trash: 'M9 3h6v2h5v2H4V5h5z M6 9h12l-1 12H7z M9 11v8h2v-8z M13 11v8h2v-8z',
  // A hammer: building works.
  build: 'M3 5h11l3 3v2h-4V9H3z M10 10h3v11h-3z',
  // Two opposed arrows: the order of a list.
  sort: 'M7 3l4 5H8v13H6V8H3z M17 21l-4-5h3V3h2v13h3z',
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
