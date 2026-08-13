# Attribute model

**Status:** specified. Resolves the "attribute model is load-bearing" risk in [roadmap.md](./roadmap.md). Decision recorded in [ADR 0004](./adr/0004-attribute-model.md).

This document is the contract between M3 (players), M2 (result resolver), M6 (training and decline) and the data pipeline. Implement against it; change it here first, not in code.

---

## The eight attributes

All are integers in **1–99**. Eight, not thirty — see ADR 0004 for why.

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

M2's Poisson model takes exactly two numbers per side: `attack` and `defence`, both on a 1–99 scale. Everything above collapses into those two. Getting this written down now is what lets M3 slot into M2 rather than rewrite it.

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

1. **Tactical sliders** (M3) — trade attack against defence around a fixed total; an all-out attacking side gains attack and loses defence.
2. **Home advantage** (M2) — lives in the resolver, not here.
3. **Form, morale, fatigue** (M6) — multipliers in roughly 0.9–1.1.
4. **Missing players** (M6) — injuries and suspensions change the XI, so they change these numbers by construction. No separate penalty term.

Result: two integers in 1–99, which is all M2 needs to know about players.

**M2 already consumes this shape.** `resolveFixture(home: TeamRating, away: TeamRating, rng)` is live, fed at M2 from provisional `Club.attack` / `Club.defence`. M3's job is to replace the _supplier_ with the collapse above — the resolver signature does not change. For scale: the calibrated model uses `SCALE = 42`, so roughly 42 rating points is one unit on the log-goals scale. A side rated ~20 points above its opponent scores about 1.6× as often.

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

Skeleton only. Filled in at M3 when the derivation layer is built — it exists now so that work is a lookup rather than a redesign. Ships fictional by default; real-name import stays a user-supplied file.

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
