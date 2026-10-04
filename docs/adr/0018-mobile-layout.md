# ADR 0018 — The game on a phone

**Status:** accepted · 2026-10-04

## Context

The game was built for a desk: the shell is a frame the height of the window, and every
screen scrolls inside its own panel. At 390px wide that left each panel a few rows tall,
the top bar overflowed sideways, the footer wrapped onto three rows and took 140px, the
club picker hid its button off the edge, and most inline controls were under 24px to
press. Breakpoints had been chosen per screen (48, 52, 60, 64, 68rem and one
`max-width: 40rem`), with no phone step at all.

## Decision

1. **One phone breakpoint, `width < 40rem`,** in CSS and in `usePhone` (`PHONE_QUERY`).
   The screens' existing steps between phone and desk stay as they are. A test fails on any
   other media query.
2. **On a phone the page scrolls as one document.** The shell drops its fixed height, the
   stage takes what is left of a short page, screens let go of the height they pinned, and
   their `1fr` rows size to content. A panel still scrolls sideways when a table is wider
   than the phone, and contains its own absolutely placed labels so the page never does.
3. **The top bar is two lines:** what you are looking at and the cog, then where you are and
   the transfer window.
4. **The footer is one row, stuck to the bottom:** back, a More button that opens save,
   saves and quit upwards, and the day's action. This is the one change that needs code;
   `ShellFoot` asks `usePhone`, and with no `matchMedia` (tests) it renders the desk footer.
5. **Every control is at least 24px to press** (WCAG 2.2, 2.5.8) below 40rem and on any
   touch screen (`pointer: coarse`), whatever its width.
6. **Screens adapt in their own CSS** under the same breakpoint: the hub becomes one column,
   the club picker becomes two-line rows with the button beside the name.
7. **The desk does not change.** Every phone rule sits behind the breakpoint or the coarse
   pointer, and the full-game screenshot comparison at 1280 stays byte-identical.

## Consequences

- Every screen fits a 390px phone with no sideways scroll, and every story shows it.
- A phone layout is reviewed in Storybook (ADR 0017) at 390 and 768.
- Two layouts to keep working. The breakpoint test and the stories are what stop the phone
  one from rotting.
