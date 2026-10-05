# Decisions

Architecture Decision Records for Futbol Manager. Each ADR in `docs/adr/` records one choice,
its context and its trade-off. The rules that follow from them are in
[principles.md](principles.md). Read the relevant ADR before reopening a settled question,
and say why the ADR is wrong if you do.

New ADR: copy the format below, take the next number, and add a line here. An accepted ADR
is not edited. Reversing it, in whole or in part, means a new ADR that says what it
supersedes. ADRs are proposed to the user before they are accepted. (0010, 0011 and 0012
record same-day partial reversals in place, which predates this rule.)

| #                                                    | Decision                                                                           | Status                                          | Date       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| [0001](docs/adr/0001-workspace-tooling.md)           | pnpm workspaces, no Turborepo                                                      | Accepted                                        | 2026-08-13 |
| [0002](docs/adr/0002-prng.md)                        | `sfc32` seeded PRNG                                                                | Accepted                                        | 2026-08-13 |
| [0003](docs/adr/0003-league-format.md)               | 20 clubs, 38 rounds, Spanish tiebreakers                                           | Accepted                                        | 2026-08-13 |
| [0004](docs/adr/0004-attribute-model.md)             | Eight player attributes, not thirty                                                | Accepted                                        | 2026-08-13 |
| [0005](docs/adr/0005-persistence.md)                 | IndexedDB + JSON export, versioned saves                                           | Accepted                                        | 2026-08-13 |
| [0006](docs/adr/0006-typescript-6-not-7.md)          | TypeScript pinned to 6.0.3, not 7.x                                                | Accepted                                        | 2026-08-13 |
| [0007](docs/adr/0007-intellectual-property.md)       | Copy the design, not the expression or the name                                    | Accepted (decision 4 partly superseded by 0010) | 2026-08-14 |
| [0008](docs/adr/0008-target-pc-futbol-5.md)          | PC Fútbol 5.0 is the v1 target; 2001 is the direction                              | Accepted                                        | 2026-08-14 |
| [0009](docs/adr/0009-the-ledger-identity.md)         | Money is accounted for, not conserved                                              | Accepted                                        | 2026-08-14 |
| [0010](docs/adr/0010-real-squad-shapes.md)           | Real squad shapes, and altered surnames                                            | Accepted                                        | 2026-08-15 |
| [0011](docs/adr/0011-a-market-abroad.md)             | A market abroad: 32 foreign clubs as a player source                               | Accepted (decision 4 reversed same day)         | 2026-08-18 |
| [0012](docs/adr/0012-generated-cover-art.md)         | The cover, and other drawn-once art, is generated                                  | Accepted (decision 1 superseded same day)       | 2026-08-19 |
| [0013](docs/adr/0013-project-knowledge-files.md)     | Project knowledge lives in principles, architecture, decisions, tasks and security | Accepted                                        | 2026-10-02 |
| [0014](docs/adr/0014-design-system-package.md)       | A design-system package, for the app and for Claude Design                         | Accepted (amends P11)                           | 2026-10-04 |
| [0015](docs/adr/0015-design-system-library-build.md) | How the design-system package is built                                             | Accepted                                        | 2026-10-04 |
| [0016](docs/adr/0016-design-system-iife-bundle.md)   | The design system ships one self-contained script for the artifact                 | Accepted                                        | 2026-10-04 |
| [0017](docs/adr/0017-storybook.md)                   | Storybook for the screens                                                          | Accepted; point 5 superseded by 0021            | 2026-10-04 |
| [0018](docs/adr/0018-mobile-layout.md)               | The game on a phone                                                                | Accepted; points 3–4 superseded by 0019         | 2026-10-04 |
| [0019](docs/adr/0019-phone-shell.md)                 | The phone shell: tabs and an action bar                                            | Accepted                                        | 2026-10-05 |
| [0020](docs/adr/0020-tag-driven-releases.md)         | Releases are tagged, and only releases deploy                                      | Accepted                                        | 2026-10-05 |
| [0021](docs/adr/0021-storybook-levels.md)            | Storybook covers the design system, in levels                                      | Accepted                                        | 2026-10-05 |

## Format

The house format, as used by every ADR above:

```md
# ADR NNNN — Title

**Status:** proposed | accepted · YYYY-MM-DD
**Supersedes:** (optional) ADR NNNN, or a single decision within it

## Context

What forces the choice.

## Decision

What we do — numbered when there is more than one.

## Consequences

What gets better and what it costs.
```
