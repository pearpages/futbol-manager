# Futbol Manager design system

The look of Futbol Manager, a football management game in the idiom of the nineties Spanish
CD-ROMs: tokens, global styles, React components, brand assets. The game imports it from
source; the Claude Design System artifact loads `dist/bundle.js` and `dist/bundle.css`.

## The idea: hardware and screens

The look is a 1999 CD-ROM, not a terminal. The visual language is **hardware**: chunky
bevelled panels you could press, with data sunk into inset screens. Everything follows from
two materials.

| Material   | Tokens                                                                                  | Holds                                   | Component                     |
| ---------- | --------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------- |
| **Panel**  | `panel`, `panel-raised`, `ink`, `ink-soft`, raised bevel                                | Controls: bars, menus, dialogs, buttons | `Panel`, `Button`             |
| **Screen** | `screen`, `screen-raised`, `screen-ink`, `screen-ink-soft`, `screen-rule`, sunken bevel | Data: tables, lists, figures            | `Screen`, `DataTable`, `Stat` |

Behind both is the `void` (`#0a120c`). There are no shadows on hardware: depth is a 1px
bevel. Raised has `bevel-light` on the top and left and `bevel-dark` on the bottom and right.
Sunken is the reverse. Pressed swaps them. The only shadow is `shadow-menu`, for something
floating over the page.

```tsx
<Panel as="header" className="shell__bar">…</Panel>
<Screen className="squad-screen">
  <ScreenHeading>Plantilla</ScreenHeading>
  <DataTable>…</DataTable>
</Screen>
```

## Colour

All tokens are in [`src/tokens.json`](src/tokens.json), with a `usage` line each, and become
`--fm-<name>` custom properties in `src/tokens.css`.

- **Brass is the only interactive accent.** `accent` (`#e8b33a`) marks the primary button
  and the focus ring; `accent-hover` is its hover, `accent-ink` the text on it.
- **Band colours mean a competition, never a role.** `champion`, `ucl`, `uel`, `uecl` and
  `relegation` encode a Spanish classification. Writing `uecl` to mean "won" cost a position
  once, which is why the roles have names of their own: `win`, `draw`, `loss` for a form
  guide and `series-a`, `series-b` for a comparison. They share colours with the bands but
  not names.
- **Money below zero** and refusals use `relegation`, or `relegation-tint` as text on a
  screen.
- **White is rare.** `highlight` is for the few marks that must outshine `screen-ink`: your
  club's row, an unread count, the play button.
- Over a screen, `overlay-1/2/3` (white at 3, 4 and 7%) mark a stripe, a selection and a
  hover; `accent-wash` marks your own row; `scrim` sits behind a dialog.

## Type

There are no web fonts. Personality comes from treatment: condensed stacks, tight uppercase
tracking, heavy weight contrast, tabular figures wherever a number appears.

| Family           | Stack                                                  | Used for                                 |
| ---------------- | ------------------------------------------------------ | ---------------------------------------- |
| `font`           | Helvetica Neue, Helvetica, Arial                       | Body text, table cells, figures          |
| `font-condensed` | Helvetica Neue Condensed, Arial Narrow, Helvetica Neue | Headings, buttons, labels, table headers |

| Size      | rem    | px  | For                                 |
| --------- | ------ | --- | ----------------------------------- |
| `text-xs` | 0.6875 | 11  | Labels, table headers, chips, hints |
| `text-sm` | 0.8125 | 13  | Table cells, buttons, notes         |
| `text-md` | 0.9375 | 15  | Body, the page default              |
| `text-lg` | 1.25   | 20  | Screen and panel headings           |
| `text-xl` | 1.75   | 28  | Headline figures in a `Stat`        |

Uppercase runs are tracked: `track-wide` (0.14em) for labels and buttons, `track-narrow`
(0.06em) for smaller runs like chips and pager labels. Headings are condensed, 700,
uppercase. Never type capitals into a string; the style uppercases.

## Space, radius, layering

- **Tight on purpose.** The subject is information-dense; generous whitespace would be a
  different product. `space-1` 4px, `space-2` 8px, `space-3` 12px, `space-4` 16px,
  `space-6` 24px, and `space-hair` 2px between tightly packed chips.
- A block is padded `space-3` vertically and `space-4` horizontally.
- **Hardware is square.** Panels, screens and buttons have no radius. `radius-sm` (3px),
  `radius-round` (50%) and `radius-pill` (999px) are for three small marks only.
- Stacking order: 1–3 inside a screen's grid, 5 the landing's floating language button, 10 a menu, 20 a
  dialog. Nothing animates; the only motion rule is a reduced-motion guard.

## Layout

The game is one shell, a single-column grid:

```
┌──────────────────────────────────────────┐
│ Panel: where · title · window · language │  shell bar
├──────────────────────────────────────────┤
│                                          │
│ stage: one screen, scrolling inside it   │
│                                          │
├──────────────────────────────────────────┤
│ Panel: back · save · saves · quit · next │  footer
└──────────────────────────────────────────┘
          made by pearpages · build           credit
```

On a phone (below `40rem`) the game has its own shell around the same screens (ADR 0019):

```
┌──────────────────────────┐
│ ‹  TITLE       ⇄ 7 d   ⋯ │  bar: back, place, window, menu
├──────────────────────────┤
│ [Segment] [Segment]      │  the tab's screens
│ panels, one under the    │  the page scrolls,
│ next, at full height     │  not each panel
├──────────────────────────┤
│ [ ▶ Play the match ]  ⏭  │  action bar: the next thing
│  ⌂    👕    ⇄    ▮▮   ⛉   │  TabBar: five places
└──────────────────────────┘
```

- **One phone breakpoint, `width < 40rem`.** Write phone rules behind it, never into the
  desk rules. The screens' own steps between phone and desk (`48`, `52`, `60`, `64`, `68rem`)
  stay as they are; don't add new ones.
- **Touch targets are 24px at least** below 40rem and on any touch screen
  (`pointer: coarse`): `Button`, `PlayerLink`, sort headers and sliders grow their height,
  the Explain "i" its size.
- **Tables scroll sideways inside their `Screen`** when wider than the phone; the page never
  does. Better still, drop the columns nobody acts on, or make each row a two-line card
  (the club picker, the market).
- Screens lay out their own blocks in CSS grid, with one container query on the landing
  cover.

## Navigation

There is no router.

- **On a desk** the hub (Menú Mànager) is the centre: four quadrants (Seguiment, Entrenador,
  Mercat, Finances), each a list of tiles that open a screen. A tile whose feature is not
  built yet is disabled and names its milestone. The footer's Torna is the one way back, and
  the footer also holds save, saves, quit and advancing the day.
- **On a phone** a `TabBar` of five places replaces the hub tiles, and `Segments` switch
  between the screens a place holds. An action bar above the tabs carries the day's action on
  every screen; save, saves, language and quit sit in the bar's ⋯ menu.
- A **dialog** (`Modal`) is for a question or a table that belongs on top of what you were
  doing; anything bigger is a screen. On a phone it rises from the bottom edge.
- **What cannot be undone asks first** (`Confirm`), saying what it costs and what is left.
  **What can be undone is done at once and offered back** (`Toast` with an action).

## Icons and art

- **Drawn in code, coloured by CSS.** Tile icons (`TileIcon`, 24-unit grid, `currentColor`),
  badges, the radar and the pitch are geometry in TypeScript and colour in CSS. No colour
  value appears in a component.
- **Badges are not crests.** A shape, a shirt pattern and a three-letter code in kit colours
  (`Badge`, 18 schemes). Nothing ever draws a real crest or traces PC Fútbol's art.
- **Painted art is generated, drawn once and only selected**: the cover, the four hub
  figures, the trophy. Copies are in `assets/Images`, the logo in `assets/Logos`, the tile
  icons as SVG in `assets/Icons`.

## Writing

Components hold no text the player reads. Every label arrives as a prop, translated by the
game in Catalan, Spanish or English, which run to different lengths. Design for the longest.

## Using it

In the game:

```tsx
import '@fm/design-system/tokens.css'
import '@fm/design-system/reset.css'
import '@fm/design-system/chrome.css'
import { Button, Screen, ScreenHeading } from '@fm/design-system'
```

In a page with no build step:

```html
<link rel="stylesheet" href="dist/bundle.css" />
<script src="dist/bundle.js"></script>
<script>
  const { React, createRoot, Button } = window.FutbolDesignSystem
  createRoot(root).render(React.createElement(Button, { type: 'button' }, 'Torna'))
</script>
```

Every component folder has a `README.md` and a `preview.html` that renders it from the
bundle.

## Commands

| Command                                        | Does                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| `pnpm --filter @fm/design-system tokens:build` | Validates `tokens.json` and regenerates `tokens.css`      |
| `pnpm --filter @fm/design-system build`        | Tokens, then `dist/bundle.js`, `bundle.css`, `index.d.ts` |
| `pnpm --filter @fm/design-system assets:build` | Regenerates the SVG tile icons from `TileIcon`            |
| `pnpm exec vitest run --project design-system` | The package's tests                                       |

Why it is a package at all: [ADR 0014](../../docs/adr/0014-design-system-package.md). How it
builds: [0015](../../docs/adr/0015-design-system-library-build.md),
[0016](../../docs/adr/0016-design-system-iife-bundle.md).
