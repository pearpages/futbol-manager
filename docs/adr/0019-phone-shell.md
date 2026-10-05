# ADR 0019 — The phone shell: tabs and an action bar

**Status:** accepted · 2026-10-05 · supersedes points 3 and 4 of ADR 0018

## Context

ADR 0018 made every screen fit a 390px phone by stacking the desk layout. It fitted, and
it was hard to play. An audit of the phone screens against what a player actually does
(run the clock, play the match, read the result, set the team; the market in two windows;
money and the board a few times a season) found:

- On the hub the next match and the Play button came after all four menu sections, about
  four screens down.
- On a matchday the footer had no action on any screen: you went back to the hub and
  scrolled to play.
- Every move went hub → tile → back → hub, through that same long scroll.
- The two-line top bar repeated the competition and round on every screen.
- The table's points column, the market's prices and buttons, and the squad's sale and
  renew buttons sat behind a sideways scroll.
- Nothing irreversible asked first: signing, accepting an offer, starting stadium works,
  taking a club, starting a new career over a live one. A formation press silently
  replaced a hand-picked XI. "Bid again" could lose the old bid.

## Decision

1. **On a phone the game gets its own shell** (`packages/app/src/phone/`), chosen by
   `usePhone()` around the same screens. The desk shell is untouched.
2. **A one-line bar:** back (only on a player page), the place's name, the transfer-window
   chip (only while open, and a way to the market), and a menu (⋯) with save, saves,
   language and quit. The competition and round leave the bar; the round goes on the match
   card.
3. **An action bar on every screen,** above the tabs: advance a day (with a skip-to-matchday
   button), play the match, start the season or leave when sacked. Playing from it shows
   the result in a sheet.
4. **Five tabs** with an icon and a word each: Today (the hub), Team (lineup, squad),
   Market, League (table, results, calendar) and Club (cash, board, stadium). A tab's
   screens are segments at the top. Tabs are derived from `screen`; there is no new
   navigation state. The market tab counts offers waiting for an answer.
5. **The hub on a phone is "Today":** the next match, where you stand and what the board
   wants, then the news. The four menu sections and the hub's own controls are hidden.
6. **Screens adapt in their own CSS under the same breakpoint:** a narrower table, market
   listings as two-line cards with the panels that need you first, the squad without its
   action columns (the player page carries them), the bench as a sheet from the pitch, the
   club picker as tappable rows.
7. **Learning without destructive actions, on both layouts:** what cannot be undone asks
   first and says what it costs in numbers (`Confirm`); a formation press is done at once
   and offered back (`Toast` with undo); several commands that must land together go
   through `dispatchAll`, which commits all or none and restores the rng on a refusal.
8. On a phone every dialog rises from the bottom edge.

## Consequences

- The most-pressed action is one tap from any screen, and every place is one tap from
  every other.
- Two shells to keep working. The desk screenshot walk at 1280 must stay byte-identical,
  the phone shell is tested with `matchMedia` stubbed (`PhoneShell.test.tsx`), and every
  screen story is reviewed at 390.
- Confirmations add a press to five actions. They were chosen because each spends money or
  starts something that cannot be taken back; anything cheaper gets undo instead.
