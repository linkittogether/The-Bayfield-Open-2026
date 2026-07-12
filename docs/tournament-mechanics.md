# The Bayfield Open — Tournament Mechanics

> **Source of truth:** how the tournament *actually* runs is defined by the annual
> results spreadsheet (e.g. `Bayfield open 2025.xlsx`) and the organizers — **not** by
> the current code. Where the code disagrees, the code is wrong. This document is the
> reference the app should be reshaped toward.

## Overview

A 3-day weekend, ~20 players. **Friday and Saturday are individual stroke play**;
**Sunday is team match play.** Three competitions are decided over the weekend:

1. **Individual** — lowest cumulative net.
2. **Pairs** — the Saturday partner competition (trophy + jackets).
3. **Huron Cup** — the two-team competition, decided by **Sunday match play** (most
   matches won). A summed team net is computed as an informational secondary standing
   but does **not** decide the cup.

## Players & teams

- **Two persistent franchises:** the **Truffle Hogs** and the **Mycelium Syndicate**,
  ~10 players each. Rosters are stable year to year, changing only by **trades or subs**
  (e.g. Steve M subbed in for 2026; Mike Harris sat out 2026).
- **Captains:** Adison E (Truffle Hogs), Josh W (Mycelium Syndicate).
- Because rosters, absences, and subs vary per year, team membership is modeled **per
  season** (`season_rosters`), not as a fixed column on players.

## Scoring model (the important part)

The fundamental unit is a **9-hole segment**, and **each 9 has its own Course Rating,
Slope, and Par**. The set of courses played — and whether a day is three 9s or an 18 + a
9 — **changes from year to year**.

For each segment:

```
courseHandicap = Index × (Slope / 113) + (CourseRating − Par)      (halve the inputs for a 9)
net(segment)   = gross(segment) − courseHandicap
```

- `courseHandicap` is **fractional and may be negative** (a low handicap on a short/easy
  nine). It is **not** rounded (the spreadsheet keeps full precision).
- A player's **weekend net = the sum of their segment nets.**
- `Index` (handicap index) comes from **The Grint**.

## The three days

| Day | Course / holes | Format | What it drives |
|-----|----------------|--------|----------------|
| **Friday (Day 1)** | Bluewater, **9 holes** | Individual stroke | Net ranking → the Saturday **pairing draft** |
| **Saturday (Day 2)** | Sunset, **27 holes** | Individual stroke (own ball) | The **Pairs** competition |
| **Sunday (Day 3)** | **18 holes** | Team **match play** | The **Huron Cup** |

### Friday — Bluewater (9 holes)
Everyone plays the same 9 holes; record gross + net. The net ranking then drives the
**pairing draft** for Saturday:

- Rank all players by Friday net.
- The **top 10 are pickers**; **10th place picks first**, then 9th, 8th … down to 1st.
- Each picker chooses a partner from the **bottom 10** (ranks 11–20).
- Result: **10 pairs** for Saturday. (Field is assumed to be 20.)

### Saturday — Sunset (27 holes)
Individual stroke play — **each player plays their own ball** (it is **not** a scramble).
Each nine is netted on its own rating/slope. The **Pairs** competition ranks the 10 pairs
by their **combined cumulative net** — i.e. both partners' **Friday 9 + Saturday 27**
(36 holes total). Lowest combined net wins the **trophy and the jackets** until next year.

### Sunday — Match play (18 holes)
Two 10-player teams play **10 head-to-head matches** (one Truffle Hog vs one Mycelium
member each). Match play is by holes won and **often ends before 18 holes**.

- **Matchups are drafted Saturday night by the two captains**, alternating
  **nominate / select**: Captain A nominates one of his players → Captain B selects one of
  his to oppose (that pairing is set) → then it **flips** (B nominates, A selects) →
  repeat until all 10 matches are set.
- The team that wins the most matches takes the **Huron Cup**.

## Handicaps & The Grint

Goal: a player can **either** have their scores imported from The Grint **or** enter them
in the app, and get the **same** result. Since both use the **WHS** course-handicap
formula above, this is achievable if the app:

1. Stores each nine's **Course Rating, Slope, and Par** (matching the tees Grint uses).
2. Uses the player's Grint **index** as the input.
3. Agrees on **rounding** — the spreadsheet uses **unrounded** course handicaps; Grint
   typically *displays* a rounded integer. Keep unrounded to match tournament tradition,
   and **validate against 2–3 players' Grint values** before trusting the calc.

Note: **match play (Sunday) uses relative strokes** (the difference between the two
players' handicaps), a separate allowance from the stroke-play course handicap.

## Where the current code diverges (re-model targets)

- **Day 2 is modeled as a scramble** (`day2_teams` + `day2_round_scores` with one combined
  pair score over 3 rounds). Reality: 27-hole **individual** stroke; the pair result is
  the **sum of two individual cumulative nets**.
- **Handicaps/net:** code computes `net = gross − floor(handicap/2)` and stores an
  **integer**. Reality: **per-9 WHS course handicap, fractional, summed**. There is no
  course/nine (rating/slope/par) model, and `players.handicap` is a single global value
  (no per-season handicap).
- **Day 3:** match-play structure (matches + per-hole winner) is roughly right, but the
  **captains' nominate/select draft** is not modeled — the app only stores the resulting
  matches.
- **Day 1 draft** (rank 10 → 1 picks from the bottom 10) is essentially correct.

## Resolved decisions

- **Huron Cup is decided by Sunday match play** (most matches won) — resolved 2026-07-12.
  The summed team net (the 2025 sheet's ~1491 vs ~1517) is a **nice-to-have** we still
  compute and display, but it does **not** decide the cup. 2025's actual Sunday match
  results aren't in the sheet, so 2025's Huron Cup result stays unrecorded (only its team
  net-sum is reconstructable).

## 2025 import status

- Imported: 2025 season, team rosters (10v10), **all stroke-play segment scores**
  (Bluewater 9 + Sunset back 9 + Sunset 18) and per-season handicap indices → the
  Individual and Pairs standings compute correctly (verified against the sheet).
- Not imported: **Sunday match-play results** (no hole-by-hole data exists in the sheet).
  The 2025 team net-sum is computable as the informational secondary standing.
