# The Bayfield Open — Tournament Mechanics

> **Source of truth:** how the tournament *actually* runs is defined by the annual
> results spreadsheet (e.g. `Bayfield open 2025.xlsx`) and the organizers. This document
> describes those mechanics; the app now implements them (see **Implementation** below).
> Courses, tees, and dates **change year to year** and are **configured per season** —
> they are never hardcoded (see **Course & tee configuration**).

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

### Stroke play (Friday + Saturday)

The fundamental unit is a **segment** — normally a 9, sometimes an 18 — and **each segment
has its own Course Rating, Slope, and Par** for the tee played.

```
courseHandicap = Index × (Slope / 113) + (CourseRating − Par)      (halve the index for a 9)
net(segment)   = gross(segment) − courseHandicap
```

- `courseHandicap` is **fractional and may be negative** (a low index on a short/easy
  nine). It is **not** rounded — the spreadsheet keeps full precision.
- A player's **weekend net = the sum of their segment nets.**
- `Index` (handicap index) comes from **The Grint**, stored **per season**.

### Match play (Sunday)

Singles matches are **handicapped**:

- Each player's **18-hole course handicap** is computed from their season index and the
  Sunday course's rating/slope/par for the chosen tee, then **rounded to a whole number**
  (you can't give a fractional stroke on a hole).
- The higher-handicap player receives **100% of the difference** between the two course
  handicaps, allocated to holes by **stroke index** (hardest holes first; a second pass
  if the difference exceeds 18).
- A hole is won by the **lower net** (gross − strokes received on that hole); equal net
  halves it. The match result follows standard closeout (`3&2`, `1 up`, `AS`).

## The three days

| Day | Format | Holes | Drives |
|-----|--------|-------|--------|
| **Friday (Day 1)** | Individual stroke | one **9** | Net ranking → the Saturday **pairing draft** |
| **Saturday (Day 2)** | Individual stroke (own ball) | **27** (typically a 9 + an 18) | The **Pairs** competition |
| **Sunday (Day 3)** | Team **match play** (handicapped) | **18** | The **Huron Cup** |

*Which courses/tees are used each day is per-season configuration — see below.*

### Friday — 9 holes
Everyone plays the same 9; record gross + net. The net ranking drives the **pairing draft**
for Saturday:

- Rank all players by Friday net.
- The **top 10 are pickers**; **10th place picks first**, then 9th, 8th … down to 1st.
- Each picker chooses a partner from the **bottom 10** (ranks 11–20).
- Result: **10 pairs** for Saturday. (Field is assumed to be 20.)

### Saturday — 27 holes
Individual stroke play — **each player plays their own ball** (it is **not** a scramble).
Each segment is netted on its own rating/slope. The **Pairs** competition ranks the 10
pairs by their **combined cumulative net** — both partners' **Friday 9 + Saturday 27**
(36 holes total). Lowest combined net wins the **trophy and the jackets** until next year.

### Sunday — Match play (18 holes)
Two 10-player teams play **10 head-to-head matches** (one Truffle Hog vs one Mycelium
member each), handicapped as described in the scoring model. Match play is by holes won
and **often ends before 18 holes**.

- **Matchups are drafted Saturday night by the two captains**, alternating
  **nominate / select**: Captain A nominates one of his players → Captain B selects one of
  his to oppose (that pairing is set) → then it **flips** (B nominates, A selects) →
  repeat until all 10 matches are set.
- The team that wins the most matches takes the **Huron Cup** (Ryder-Cup half-points; a
  halved match is ½ each).

## Course & tee configuration

Courses, tees, and dates are **not fixed** — they are declared **per season** and drive
what the app pulls from The Grint.

- Each day's rounds are stored as **segments** (`day`, `holes`, `date`, `tee`, and a link
  to a `course`); each course carries its **Grint course id**.
- **`scripts/setup-season.ts`** (`npm run season:setup`) is the declarative per-year config.
  Given a course + tee, it **auto-pulls Course Rating / Slope / Par from The Grint** (and,
  for the Sunday course, the per-hole **stroke index** into `course_holes`).
- The group generally plays **the regular members' tees** (White/Blue where they exist),
  **not** the back/tournament tees — and the right tee varies by course. Tees are
  **selectable in the app** at **`/[year]/courses`** (admin); changing a tee re-pulls the
  rating/slope/par + stroke index. Use `npm run grint:tees -- --course "<name>"` to see a
  course's exact Grint tee names.

*Illustrative only (subject to change): 2025 = Bluewater (Fri 9) + Goderich Sunset (Sat
back-9 + 18); 2026 = Bluewater (Fri 9) + Ironwood (Sat back-9 + 18) + Woodlands Links
(Sun match play).*

## Handicaps & The Grint

A player's scores can be **imported from The Grint** or **entered in the app**, and both
give the **same** result (same WHS formula). This is shipped:

- **Index/handicap sync** from Grint profiles (`npm run grint:handicaps`).
- **Stroke-play import**: batch (`npm run grint:import`, matched by course + holes + date)
  or a per-player **“Pull from The Grint”** button on the Day 1/2 score forms.
- **Match-play import**: **“Pull match from The Grint”** fills both players' Sunday round
  hole-by-hole from their logged scorecards.
- WHS parity with Grint was validated: our unrounded stroke-play course handicap matches
  Grint's inputs, and the back-solved 2025 slopes reproduce the sheet exactly.

Rounding differs by format: **stroke play stays unrounded** (tournament tradition); **match
play rounds** each course handicap to a whole number so strokes fall on whole holes.

## Resolved decisions

- **Huron Cup is decided by Sunday match play** (most matches won). The summed team net
  (the 2025 sheet's ~1491 vs ~1517) is a **nice-to-have** we still compute and display, but
  it does **not** decide the cup.
- **Match-play handicap allowance is 100%** of the difference in (rounded) course handicaps,
  allocated by stroke index.

## Implementation

- **WHS engine:** `src/lib/handicap.ts` (stroke play); **match-play engine:**
  `src/lib/matchplay.ts` (strokes, per-hole net winner, closeout).
- **Scoring/standings:** `src/lib/server/scoring.ts`; **days:** `src/lib/server/day1.ts`,
  `day2.ts`, `day3.ts`.
- **Grint:** `src/lib/server/grint-rounds.ts` (fetch rounds / course data / hole scores),
  `grint-import.ts` (matching), plus `scripts/grint-*.ts` and `setup-season.ts`.
- **Data model:** `seasons`, `teams`, `season_rosters`, `courses` (+ `grintCourseId`),
  `segments` (+ `tee`/`date`/`grintRound`), `segment_scores`, `course_holes`,
  `day2_teams`, `day3_matches`, `day3_holes` (per-hole grosses; legacy `winner` retained
  for imported 2025 rounds).

## 2025 import status

- Imported: 2025 season, team rosters (10v10), **all stroke-play segment scores** and
  per-season handicap indices → the Individual and Pairs standings compute correctly
  (verified against the sheet).
- Sunday match play was imported as **per-hole winners** (reconstructed from the recorded
  results, since the sheet has no hole-by-hole grosses) → Mycelium won the Huron Cup
  **6.5–3.5**. The match-play engine falls back to these stored winners for 2025; from 2026
  on, matches are scored from per-hole grosses.
