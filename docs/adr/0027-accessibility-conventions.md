# ADR 0027 — Accessibility conventions: focus, announcements, names and timing

**Status:** accepted · 2026-10-06

## Context

An audit on 2026-10-06 (axe-core in Chrome over every story and the live game at 390 and
1280, plus two code reviews) found the game mostly well built and silent whenever it moved.
A new screen, a new day and a toast said nothing to a screen reader, and focus fell to
`<body>` when the pressed control left with the old screen. Other findings came from choices
each screen had made on its own: twenty-five buttons all named "Renova", toggles whose label
and `aria-pressed` both changed, an undo that left after six seconds, and a brass focus ring
that showed at 1.02:1 on the panel.

The fixes are in the code, but each was a choice between alternatives. Without a record, the
next screen picks again:

- **Focus on a screen change:** always move it to the title, never move it, or move it only
  when it was lost.
- **Announcements:** one live region in the shell, or one per component.
- **A toast with an action:** a longer timer, pause on hover, or no timer at all.
- **Naming a row's button:** visible text plus hidden text, `aria-describedby` pointing at
  the row, or an `aria-label` built from a whole dictionary sentence.

`breakpoints.test.ts` also says a new media query is a decision for an ADR. This work adds
`(forced-colors: active)`.

## Decision

1. **Focus after a screen change goes to the screen's title only when it was lost.** If the
   pressed control is still on the page (a tab, a segment), focus stays on it and the
   shell's live region names the place. If it left with the old screen (a player link,
   Back), focus goes to the bar's `h1`, which has `tabIndex={-1}`. The page's `<title>` is
   `{screen} · Futbol Manager`.
2. **The shell owns one live region**, which is always mounted. It says the place you moved
   to and, when a day advances, the new date and how much news came with it. A component
   that announces on its own does it the way `Toast` does: through a region that exists
   before its text arrives, because a region inserted already holding its words is ignored
   by many screen readers.
3. **A toast with an action waits.** It stays until the action or its close button, which it
   must offer (`closeLabel`). A toast without an action leaves on its own and holds while
   hovered or focused. When a toast leaves holding focus, focus goes back to where it was
   when the toast arrived. This meets WCAG 2.2.1 for an undo without guessing how long is
   long enough.
4. **A button repeated on every row names its row in an `aria-label`**, built from a whole
   dictionary sentence with a parameter (`squad.renewPlayer`: "Renova {player}"), never
   assembled from fragments (P16). The visible label is the start of the name (WCAG 2.5.3).
5. **A toggle keeps one label and states its state with `aria-pressed`** and a visual mark
   (a filled star, the primary fill). A label that also changed would announce the state
   twice and break 2.5.3.
6. **Nothing that takes focus sits inside a heading.** A control beside a heading goes in
   `ScreenHeading`'s `aside`. Chrome reads a child button's label into the heading's name,
   while jsdom leaves it out, so the suite asserts structure (no button inside a heading)
   rather than the name.
7. **The focus ring is two-tone**: an ink outline around a brass band, so it reads on both
   the panel and the screen. A component that removes the outline draws a replacement that
   differs from its selected state (the pitch's focus ring).
8. **`(forced-colors: active)` joins the agreed media queries.** It is a preference, not a
   width. In High Contrast mode, a state drawn only as a fill (pressed, current, the tab bar
   marker, the pitch selection) gets a system-coloured border.
9. **A disabled control says why in words anyone can reach**: visible text where there is
   room, hidden text in the cell where there is not. A `title` alone reaches mouse users only.

## Consequences

- Moving through the game is announced, and keyboard users no longer restart from the top
  of the page after following a link.
- The undo toast can sit on screen until it is dismissed, which is one more press for
  someone who wants it gone.
- Tests resolve row buttons by stem (`labelStem`) or by their full name with the player, not
  by the bare verb. A heading's name is not proof that nothing is nested in it.
- "Seguit" and "En venda" no longer appear as button text; the star and the fill carry the
  state.
- Every new screen inherits these rules. Breaking one is a question for a new ADR, not a
  local choice.
