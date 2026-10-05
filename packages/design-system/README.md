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
- **Money below zero** and refusals use `relegation` for marks (borders, swatches), and
  `relegation-ink` or `relegation-tint` as text on a screen. `relegation` itself is 3.45:1
  there, too dark to read. The DF chip's text is `ucl-ink` for the same reason.
- **Ink follows the surface.** `ink` and `ink-soft` on the panel, `screen-ink` and
  `screen-ink-soft` on the screen. Never mix them: screen ink on the panel is 1.6:1. A
  dialog's body is a screen, so fields, notes and lists read as they do everywhere else.
- **Every pair passes WCAG AA** (4.5:1, 3:1 for large text). Check a new colour against the
  surfaces it will sit on before adding it.
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

The game is one shell at every width (ADR 0022). Mobile first: the desk is the phone with
more room, never a second design.

```
Phone (below 40rem)                Desk
┌──────────────────────────┐      ┌──────┬──────────────────────────────────────────┐
│ ‹  PLACE      ⇄ 7 d 📰 ⋯ │      │ PLACE        ⇄ 7 d  📰  Desa  Partides  Surt  CA│ bar
├──────────────────────────┤      ├──────┼──────────────────────────────────────────┤
│ [Segment] [Segment]      │      │ ⌂    │ [Segment] [Segment]                      │
│ the screen; the page     │      │ 👕   │ the screen, scrolling inside the stage,  │
│ scrolls as one document  │      │ ⇄    │ panels side by side                      │
├──────────────────────────┤      │ ▮▮   │                                          │
│ [ ▶ Play the match ]  ⏭  │      │ ⛉    │              [ ▶ Play the match ]  ⏭     │ action
│  ⌂    👕    ⇄    ▮▮   ⛉   │      └──────┴──────────────────────────────────────────┘
└──────────────────────────┘        rail
```

- **The same parts at every width.** Places, words, icons, features and components are the
  phone's; a wider screen only adds room. `usePhone()` may choose where something sits,
  never whether it exists.
- **One phone breakpoint, `width < 40rem`.** Write phone rules behind it. The screens' own steps between phone and desk (`48`, `52`, `60`, `64`, `68rem`)
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

- **Five places** in a `TabBar`: along the bottom on a phone, a rail on the left on the desk.
  `Segments` switch between the screens a place holds, with each screen's tile icon. Avui is
  home.
- **The day's action** (advance, skip to the matchday, play, start the season) is on every
  screen, under the stage; a played match shows its result in a sheet.
- **The game menu** (save, saves, language, quit) is in the bar: inline on the desk, behind ⋯
  on a phone.
- A **dialog** (`Modal`) is for a question or a table that belongs on top of what you were
  doing; anything bigger is a screen. On a phone a short one (a question, a choice) rises
  from the bottom as a sheet, and a list or a form (`full`) takes the whole screen with a
  close button. The page behind never scrolls.
- **Menus close on a press outside them or Escape** (`useDismiss`).
- **Nothing disables zoom.** Double-tap zoom is off (`touch-action: manipulation`) and
  fields are 16px on touch screens so iOS does not zoom into them; pinch still works.
- **What cannot be undone asks first** (`Confirm`), saying what it costs and what is left.
  **What can be undone is done at once and offered back** (`Toast` with an action).

## Icons and art

- **A verb that recurs gets a glyph before its word** (`Button icon`): save, the saves,
  leave, advance a day, play, bid (`cash`), terms and renewals (`sign`), for sale (`tag`),
  follow (`star`), accept (`check`), close, delete (`trash`), build. The word always stays;
  an icon alone is a guess. Only universal glyphs stand alone, and then with an accessible
  name: ×, ‹, ⋯, ⏭ and the news button. Cancel has no glyph, so the safe choice never looks
  like the action.
- **A place gets its place's picture, the same one everywhere.** On a phone the shell's
  segments carry the icon of the hub tile that opens that screen on the desk (`Segments`
  `icon`, stacked above the label), and the market's two tabs carry `tag` and `club`.
  Filters, settings and the results' inner views take no picture.

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

**See it first in Storybook** (`pnpm storybook`): foundations (every token, with each
ink's contrast), primitives, components, then the game's screens, at phone, tablet and desk
width. Each component's story sits beside it as `<Name>.stories.tsx`, on the surface it is
drawn for (ADR 0021).

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
