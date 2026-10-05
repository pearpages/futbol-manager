# ADR 0022 — One game at every width: the desk is the phone with more room

**Status:** accepted · 2026-10-05 · supersedes ADR 0018 and ADR 0019

## Context

ADR 0019 gave the phone a second shell and kept the desk byte-identical, so every
improvement made on the phone stayed there. An inventory found about twenty differences
that were not layout:

- playing the match from any screen, and the result sheet;
- news and its unread count off the hub;
- the offers badge;
- the window chip's icon and link;
- the board's target;
- clearing filters;
- listing a player from his card;
- the same place named "Avui" on one and "Menú Mànager" on the other;
- Plantilla grouped differently on each;
- different icons for the same thing.

Two versions of the game were drifting apart.

## Decision

1. **Mobile first.** The phone defines the game: its places, words, icons, features and
   components. A wider screen only adds room — more columns, panels side by side, controls
   inline instead of in a sheet — never a feature, a name or an icon of its own.
2. **One shell** (`app/src/shell/Shell.tsx`) at every width. It holds:
   - a bar with the place, the transfer-window chip, the news button and the game menu
     (folded behind ⋯ on a phone, inline on the desk);
   - the five places as a `TabBar` (along the bottom on a phone, a rail on the left on the
     desk);
   - the place's screens as `Segments`;
   - the stage;
   - the day's action (`DayAction`): advance, skip to the matchday, play, start the season,
     leave when sacked, and the result sheet after a match.
3. **Avui is the hub at every width:** the next match with its round, where you stand with
   the board's target, then the news. The PC Fútbol quadrant hub, its tiles and its figures
   retire; the rail is the menu.
4. **The phone's breakpoint stays the one breakpoint for code** (`usePhone`). In code it may
   only choose where something sits, never whether it exists.
5. **`shell/parity.test.tsx`** renders every screen at phone and at desk width and requires
   the same shell controls by name. Screens differ only in how much fits.

## Consequences

- An improvement lands once, for everyone.
- The desk loses the PC Fútbol hub with its four coloured sections and staff figures. The
  places and their icons carry the same groups, and the figures and quadrant colours are
  free to return as decoration on Avui if wanted.
- The desk's footer (`ShellFoot`) and its bar are gone; tests navigate as a player does, by
  place and segment (`testing.ts`).
