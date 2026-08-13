# ADR 0004 — Player attributes: eight, not thirty

**Status:** accepted · 2026-08-13

## Context

The roadmap lists the attribute model as the project's second-largest risk: "getting it wrong surfaces as vague 'the game feels arbitrary' complaints in M4, three months after the mistake." It is the spine of M3, the input to M2's resolver, the output of the data pipeline, the thing M6 trains, and the thing M7 hides behind fog-of-war.

Two reference points: PC Fútbol used a small set of coarse, readable attributes; Football Manager uses ~30 split across technical, mental and physical.

## Decision

**Eight attributes**, integers 1–99: `pace`, `finishing`, `passing`, `dribbling`, `tackling`, `heading`, `keeping`, `stamina`.

Four positions (`GK`, `DF`, `MF`, `FW`), each with a weight vector producing a derived `overall`.

Full specification — weights, age curve, the M3→M2 resolver contract, and the data-pipeline mapping — lives in [`docs/attribute-model.md`](../attribute-model.md). That document is the spec; this ADR only records the granularity choice.

## Consequences

- Every attribute has to be _visibly_ load-bearing, since there are few enough that a player can read all eight at once. This is the intended feel — closer to PC Fútbol than to a spreadsheet.
- The data pipeline has eight targets to derive rather than thirty, which makes the FBref/StatsBomb mapping tractable in the ~2 weeks budgeted. It also makes each mapping more load-bearing: a bad derivation has nowhere to hide.
- ~40 UI screens each render eight numbers, not thirty. Direct saving on the roadmap's "screen count is the silent cost" risk.
- **Cost accepted:** less texture in M4's transfer decisions. Two forwards with identical eight-attribute profiles are genuinely interchangeable, where an FM-style model would distinguish them by composure or work rate. If this becomes the thing that makes transfers feel flat, the fix is to add mental attributes as a _ninth-and-tenth_, not to restructure — the position weight vectors extend without breaking existing saves beyond a defaulting migration.
