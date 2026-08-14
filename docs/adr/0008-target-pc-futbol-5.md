# ADR 0008 — Target PC Fútbol 5.0 for the first delivery; 2001 is the direction

**Status:** accepted · 2026-08-14

## Context

Every document in this project opened by calling it "a PC Fútbol 2001-style football management game". That is the wrong thing to aim a first delivery at, and it had gone unexamined since the roadmap was written.

**PC Fútbol 2001 was the end of a run, not the start of one.** It sat on five years and several editions of accumulated depth, built by a studio that was already shipping. Naming it as the target sets the bar at a finished product's feature list and gives no answer to the only question that matters early: what is the smallest thing worth playing?

**PC Fútbol 5.0 (1996/97) is a deliverable target.** It is also the series' first Windows 95 entry — which matters more than it sounds, because the chrome this project already builds is the Windows 95 idiom: raised bevelled panels holding controls, data sunk into recessed screens. Aiming at 5.0 makes the existing visual direction more coherent, not less.

Two observations made this cheap:

- **The roadmap already sequences the work this way.** M0–M5 is a single league with squads, tactics, transfers and an economy. M6–M7 is the drift toward the later games' depth: injuries, form, training, a cup, a second division, continental competition, youth and scouting. Only the label at the top was wrong.
- **The visual note was dated wrong.** Both `CLAUDE.md` and the roadmap said "a 1999 Spanish CD-ROM". The conclusion drawn from it was right; the year was not.

## Decision

**The first delivery targets PC Fútbol 5.0. The depth of the later games is the direction, not the v1 scope.**

The milestone ladder carries the split, and every milestone sits on one side of it:

|                           | Milestones | What it is                                                                                                                  |
| ------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| **The 5.0-shaped game**   | M0–M5      | One league. Squads, lineups, tactics, a transfer market, an economy and a board. Playable, finishable, coherent on its own. |
| **The drift toward 2001** | M6–M7      | A living squad — injuries, suspensions, form, training. Then a cup, a second division, Europe, youth and scouting.          |

**Ground rule 5 is reaffirmed, not relaxed.** "Scalable" here does not mean abstracting now for a scope that has not arrived — that is still the failure mode, and a generic competition DSL remains an explicit non-goal. What makes growth additive is the seams already in place:

- `reduce(state, command, rng)` as the single door into state, which the harness and the UI both drive;
- `schemaVersion` with a forward-only migration chain, so a save survives a schema that grows;
- package boundaries enforced twice, so `domain` cannot acquire a dependency by accident;
- a resolver contract (`TeamRating`) that swapped its supplier wholesale at M3 without changing signature.

Those are what let M6 hang pure functions off the day pipeline and M7 introduce a second competition without a rewrite. **The ladder is the scalability plan.**

## Consequences

- A reader can tell which milestones are the product and which are ambition. "Is this in v1?" has an answer.
- **The existing chrome needs no change** and is better justified than before — bevelled panels are Windows 95, and 5.0 is the Windows 95 game.
- Scope pressure has somewhere to go. A feature that belongs to the later games is not refused, it is placed at M6 or M7.
- **Earlier ADRs still say "2001" and are left as written.** [ADR 0003](./0003-league-format.md) and [ADR 0007](./0007-intellectual-property.md) are dated records of decisions taken when that was the stated target; editing them would erase when this changed. Neither decision is affected — 20 clubs and Spanish tiebreakers describe both games, and the intellectual-property position covers the series and the studio rather than one edition.
- Visual reference for 5.0 lives in a gitignored `assets/` folder, under the rules in [ADR 0007](./0007-intellectual-property.md): study the idiom, never reproduce the screens, never commit the images.
