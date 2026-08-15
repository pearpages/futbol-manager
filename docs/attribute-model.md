# Attribute model

**Status:** specified. Resolves the "attribute model is load-bearing" risk in [roadmap.md](./roadmap.md). Decision recorded in [ADR 0004](./adr/0004-attribute-model.md).

This document is the contract between M3 (players), M2 (result resolver), M6 (training and decline) and the data pipeline. Implement against it; change it here first, not in code.

---

## The eight attributes

All are integers, clamped to **1–99**, and in the shipped league they occupy roughly **45–99**. Eight, not thirty — see ADR 0004 for why.

**On the scale.** A player's `overall` runs **62–93**: the typical Primera player is 73, a good one 83, a star 90+, and nothing in a first-division squad is below 60. Six players in the league reach 90. That is deliberate and it is the PC Fútbol reading of a rating. It was not always so — the scale used to put the median at 59 with half the league under 60 — and the renumbering was free because `expectedGoals` reads ratings _only_ as `attack − defence`, so scaling `MODEL.SCALE` by the same factor leaves every result identical. See the 2026-08-15 session entry in `CLAUDE.md`.

| Attribute   | Means, mechanically                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `pace`      | Acceleration and top speed. Drives getting behind a defence and recovering when beaten.                             |
| `finishing` | Converting a chance into a goal. The single largest input to attack.                                                |
| `passing`   | Accuracy and range of distribution, including the final ball.                                                       |
| `dribbling` | Close control and beating an opponent one-on-one. Creates chances that `passing` can't.                             |
| `tackling`  | Winning the ball back, plus defensive positioning. The largest input to defence.                                    |
| `heading`   | Aerial duels, in both boxes. Contributes to attack and defence.                                                     |
| `keeping`   | Shot-stopping, handling, command of the area. Outfield players sit at 1–10 and it is never trained.                 |
| `stamina`   | Sustaining output across 90 minutes and across a congested fixture list. Modulates the others late in matches (M6). |

**Invariant:** these are the _true_ values. Fog-of-war in M7 stores these unchanged and exposes a separately-computed estimate. Never store the estimate in place of the truth.

---

## Positions and overall rating

Four positions: `GK`, `DF`, `MF`, `FW`.

`overall = clamp(1, 99, round(Σ weight[position][attr] × player[attr]))`

Each row sums to exactly 1.00.

|        | `pace` | `finishing` | `passing` | `dribbling` | `tackling` | `heading` | `keeping` | `stamina` |
| ------ | ------ | ----------- | --------- | ----------- | ---------- | --------- | --------- | --------- |
| **GK** | 0.05   | 0.00        | 0.10      | 0.00        | 0.05       | 0.05      | 0.70      | 0.05      |
| **DF** | 0.15   | 0.03        | 0.15      | 0.05        | 0.30       | 0.20      | 0.00      | 0.12      |
| **MF** | 0.10   | 0.10        | 0.30      | 0.15        | 0.15       | 0.02      | 0.00      | 0.18      |
| **FW** | 0.20   | 0.32        | 0.10      | 0.18        | 0.00       | 0.12      | 0.00      | 0.08      |

A keeper's `finishing` is worth nothing; their `keeping` dominates. A striker's `tackling` is worth nothing. This is the intended behaviour — `overall` answers "how good is this player _at their position_", and is a display and valuation number. **It is not what the resolver consumes.** That is the next section.

---

## Bridge to M2 — the resolver contract

M2's Poisson model takes **three** numbers per side: `attack` and `defence` on the rating scale (60–94 in practice), plus `tempo` on −1…+1. Everything above collapses into those. Getting this written down is what lets M3 slot into M2 rather than rewrite it.

> **Changed at M3c.** This was two numbers until the tactical slider was measured and found to be a trap — upside 0–3 points, downside −4 to −9, with balanced optimal at every club. `attack` and `defence` only describe how strength is _split_; nothing described how _open_ a game is, so a low block could not do the one thing a low block is for. `tempo` is that third dimension. See [Step 4](#step-4--modifiers).

### Step 1 — per-player ratings

Attribute weights here are **position-independent**. A defender who can finish contributes to attack; that is the point.

```
playerAttack  = 0.35·finishing + 0.25·dribbling + 0.20·passing + 0.12·pace + 0.08·heading
playerDefence = 0.40·tackling  + 0.25·heading   + 0.20·pace    + 0.15·stamina
```

Keepers are special-cased: `playerDefence = keeping`, `playerAttack = 0`.

### Step 2 — position contribution shares

How much a slot's rating counts toward the team number:

|      | attack share | defence share |
| ---- | ------------ | ------------- |
| `GK` | 0.00         | (see below)   |
| `DF` | 0.15         | 1.00          |
| `MF` | 0.45         | 0.50          |
| `FW` | 1.00         | 0.15          |

### Step 3 — team ratings

```
teamAttack  = Σ(attackShare × playerAttack)  / Σ(attackShare)          // outfield only
outfieldDef = Σ(defenceShare × playerDefence) / Σ(defenceShare)        // outfield only
teamDefence = 0.65 × outfieldDef + 0.35 × keeperDefence
```

The keeper carries 35% of the defensive rating alone. That is deliberate: a great keeper behind a poor back four should visibly matter.

### Step 4 — modifiers

Applied to `teamAttack` / `teamDefence` after step 3, in this order, so each milestone bolts on without touching the ones before it:

1. **The tactical slider** (M3) — one control, 0–100, doing two things at once:
   - **Split.** Trades attack against defence, with both extremes surrendering 1.6× what they gain. The asymmetry exists because a symmetric trade was strictly exploitable: under three-points-for-a-win, converting a draw into a 50/50 result is worth +0.5 points, so all-out attack was a free +2.1 points a season until M3a fixed it.
   - **Tempo.** `(attacking − 50) / 50`, so −1 at a full low block and +1 at all-out attack. This is how open the game is, and it is the half that makes the slider a decision rather than a cost.
2. **Home advantage** (M2) — lives in the resolver, not here.
3. **Form, morale, fatigue** (M6) — multipliers in roughly 0.9–1.1.
4. **Missing players** (M6) — injuries and suspensions change the XI, so they change these numbers by construction. No separate penalty term.

**How tempo reaches the scoreline.** Both sides shape a game, so the resolver averages them and applies the result to _both_ expected-goal figures:

```
combined = (home.tempo + away.tempo) / 2
λ_home   = exp(BASE + SLOPE×(atk_h − def_a)/SCALE + HOME_EDGE + TEMPO×combined)
λ_away   = exp(BASE + SLOPE×(atk_a − def_h)/SCALE            + TEMPO×combined)
```

Lower tempo means fewer goals for everybody, which means more draws — and a draw is worth far more to the weaker side than the stronger one. That is the whole mechanism: **a low block is the underdog's weapon, and it costs the favourite.** It also means tempo is not free for either party; you cannot smother a game without giving up your own chances.

**At balanced tactics `combined` is 0 and the term vanishes**, so the M2 calibration is untouched by construction. Only deviation from balanced changes anything.

Result: two integers plus a tempo in −1…+1, which is all M2 needs to know about players. `teamRatingRaw` returns them **unrounded**, which is what `needFor` scores against — rounding a difference of two rounded numbers is what once made four separately-written market thresholds all mean the same thing.

**M2 already consumes this shape.** `resolveFixture(home: TeamRating, away: TeamRating, rng)` is live, fed at M2 from provisional `Club.attack` / `Club.defence`. M3's job is to replace the _supplier_ with the collapse above — the resolver signature does not change. For scale: the calibrated model uses `SCALE = 20.96`, so roughly 21 rating points is one unit on the log-goals scale. A side rated ~10 points above its opponent scores about 1.6× as often. **`SCALE` is the only rating-dimensioned constant in the resolver**, which is why a rescale costs one number here.

---

## What actually moves results

The weights above are the design. This section is their **observable consequence**, which is not obvious from reading them — it only shows up when you measure. Written down because M4 has to price players, and pricing them wrong is how a transfer market gets broken.

Measured 2026-08-14, Almería (the weakest club), 20 seasons per row.

### The shares, as percentages of the final number

The steps above are weights; these are what a person can reason with. Every column is the share of that team number the position owns.

|        | Attack (4-4-2) | Defence (4-4-2) | Attack (4-3-3) | Defence (5-3-2) |
| ------ | -------------- | --------------- | -------------- | --------------- |
| **GK** | 0%             | **35%**         | 0%             | 35%             |
| **DF** | 14%            | 41%             | 12%            | **48%**         |
| **MF** | 41%            | 21%             | 27%            | 14%             |
| **FW** | **45%**        | 3%              | **61%**        | 3%              |

### Leverage, in league points

One starter replaced by a 90-rated player, everything else unchanged:

| Signing       | Points gained | Per player |
| ------------- | ------------- | ---------- |
| Goalkeeper    | +10.5         | **+10.5**  |
| 4 defenders   | +16.4         | +4.1       |
| 2 forwards    | +7.6          | +3.8       |
| 4 midfielders | +11.5         | +2.9       |

**The goalkeeper is worth ~2.5× any other single signing.** That follows directly from 35% of the defensive rating resting on one player — a deliberate choice made so "a great keeper behind a poor back four should visibly matter", and this is the size of that decision. If a keeper being the most valuable player in a squad ever feels wrong, `KEEPER_WEIGHT` in `lineup.ts` is the dial, and the harness bands are what would have to stay green.

### What turns out not to matter

- **Formation, currently.** It only re-weights the shares. Generated squads scale every position from a single club rating, so nothing is lopsided enough for a shape to exploit — measured spread across all four formations is under 1.5 points. This becomes a real decision once M4 lets a squad become unbalanced.
- **Cleverness about lineup selection.** `bestXI` ranks by `overall`, which uses different weights than the resolver does, so in principle it could leave points on the table. An XI picked by actual contribution to `attack`/`defence` instead changes 0–1 slots and gains ~0.1 points.
- **Tactics — until M3c.** The upside used to be 0–3 points against a −4 to −9 downside, with balanced optimal at every club. Adding `tempo` fixed that: the best approach now runs with club strength. **Madrid gains +3.5 attacking, Almería +2.9 with a low block, and mid-table clubs are punished either way.** Still small next to a signing, which is the point — a manager wins by building a squad, not by nudging a slider.

**These figures are downstream of the M2 calibration.** Change `MODEL` in `resolve.ts`, the position weights above, or squad generation, and they move. Re-measure rather than trusting the table.

---

## Age curve

The curve is a **multiplier on progression**, never on the stored value. Attributes only change through M6's `training` step in the day pipeline; nothing derives a value from age at read time. That keeps saves honest and makes decline visible in the player's history rather than implied.

Attributes fall into three classes with different peaks:

| Class     | Attributes                         | Peak | Decline from |
| --------- | ---------------------------------- | ---- | ------------ |
| Physical  | `pace`, `stamina`                  | 25   | 28           |
| Mixed     | `tackling`, `heading`, `dribbling` | 27   | 30           |
| Technical | `finishing`, `passing`, `keeping`  | 29   | 32           |

Progression multiplier by age relative to the class's peak:

| Age vs. peak         | Multiplier |
| -------------------- | ---------- |
| ≤ −8 (very young)    | +1.5       |
| −7 to −3             | +1.0       |
| −2 to +1 (at peak)   | +0.3       |
| +2 to decline age    | 0.0        |
| decline age +1 to +3 | −0.8       |
| beyond that          | −1.6       |

`delta = baseTrainingGain × multiplier × facilityFactor + rng noise`, clamped so no attribute leaves 1–99.

M6's exit criterion — "a 34-year-old declines, a 19-year-old improves" — is a direct test of this table. Keepers peaking latest is why a 36-year-old keeper is still viable and a 36-year-old winger is not.

---

## Bridge to the data pipeline

Skeleton only. Filled in at M3 when the derivation layer is built — it exists now so that work is a lookup rather than a redesign. **Note the shipped data moved ahead of this table**: `packages/data/src/rosters.ts` now carries real squad _shapes_ — positions, ages, and the value order inside a position group — while attributes are still generated and calibrated onto the club rating. Mapping per-90 stats onto the eight attributes is still the unbuilt part. See [ADR 0010](./adr/0010-real-squad-shapes.md).

| Attribute   | Candidate FBref / StatsBomb per-90 inputs                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pace`      | **No direct stat.** Proxy from progressive carries p90 + take-ons attempted p90. Weakest mapping in the table — flag it during M3. |
| `finishing` | Non-penalty goals p90, npxG p90, goals − npxG (over-performance), shot-on-target %                                                 |
| `passing`   | Pass completion %, progressive passes p90, key passes p90, passes into final third p90                                             |
| `dribbling` | Successful take-ons p90, take-on success %, progressive carries p90                                                                |
| `tackling`  | Tackles won p90, interceptions p90, % of dribblers tackled, blocks p90                                                             |
| `heading`   | Aerial duels won p90, aerial duel win %                                                                                            |
| `keeping`   | PSxG − goals allowed p90, save %, cross-stop %, launched-pass completion %                                                         |
| `stamina`   | Share of available minutes played, matches started; distance covered where available                                               |

Two constraints on the derivation, both of which will bite if ignored:

- **Normalise within position before scaling to 1–99.** A centre-back's raw tackle numbers against a winger's are not comparable, and a naive global scaling produces a league of 90-rated defenders and 30-rated forwards.
- **Normalise within league.** Per-90 rates in a weak league are inflated relative to the players' actual quality.
