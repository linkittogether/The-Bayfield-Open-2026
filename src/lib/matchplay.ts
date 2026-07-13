/**
 * Singles match-play engine (Sunday / Huron Cup). Pure and framework-free so it
 * runs on both server and client.
 *
 * Handicapping: each player's 18-hole course handicap is computed (WHS, rounded
 * to a whole number — you can't give a fractional stroke on a hole), the
 * higher-handicap player receives **100% of the difference** (default), and
 * those strokes are allocated to the lowest stroke-index holes. A hole is won by
 * lower NET (gross − strokes received on that hole); equal net halves it. The
 * match result follows standard closeout ("3&2" / "1 up" / "AS").
 *
 * "truffle" and "syndicate" are the two sides (Truffle Hogs vs Mycelium Syndicate).
 */

import { courseHandicap } from "./handicap";

export type Side = "truffle" | "syndicate";
export type HoleOutcome = Side | "tie";

export interface MatchCourse {
  rating: number | null;
  slope: number | null;
  par: number | null;
}

export interface MatchHoleInput {
  holeNumber: number; // 1..18
  strokeIndex: number | null; // hole handicap 1..18
  truffleGross: number | null;
  syndicateGross: number | null;
}

export interface MatchHoleResult {
  holeNumber: number;
  strokeIndex: number | null;
  truffleGross: number | null;
  syndicateGross: number | null;
  truffleStrokes: number; // strokes received on this hole
  syndicateStrokes: number;
  truffleNet: number | null;
  syndicateNet: number | null;
  outcome: HoleOutcome | null; // null until both grosses are in
}

export interface MatchStatus {
  diff: number; // truffle holes up (negative = syndicate up)
  holesDecided: number;
  lastHole: number; // highest hole number with an outcome
  status: "in_progress" | "final";
  winner: Side | "halved" | null; // null while in_progress
  label: string; // "3&2", "2 up", "AS", "2 up thru 7", ""
  decidedAtHole: number | null;
}

export interface MatchResult extends MatchStatus {
  truffleCourseHandicap: number | null;
  syndicateCourseHandicap: number | null;
  strokesDiff: number;
  receiver: Side | null; // who gets strokes
  holes: MatchHoleResult[];
}

/** Rounded 18-hole course handicap, or null if course inputs are missing. */
export function courseHandicapFor(index: number, course: MatchCourse): number | null {
  if (course.rating == null || course.slope == null || course.par == null) return null;
  return Math.round(
    courseHandicap({ index, slope: course.slope, rating: course.rating, par: course.par, holes: 18 }),
  );
}

/** Strokes the receiver gets on a hole of the given stroke index. */
export function strokesOnHole(strokesDiff: number, strokeIndex: number | null): number {
  if (strokesDiff <= 0 || strokeIndex == null) return 0;
  const base = Math.floor(strokesDiff / 18);
  const extra = strokeIndex <= strokesDiff % 18 ? 1 : 0;
  return base + extra;
}

/**
 * Walk a hole-by-hole outcome sequence into a match status (holes up + closeout).
 * `outcomes` is indexed by hole (entries for un-played holes are null/absent).
 * Reused by both the gross-based path and the legacy stored-winner path.
 */
export function matchStatusFromOutcomes(
  outcomes: { holeNumber: number; outcome: HoleOutcome | null }[],
  totalHoles = 18,
): MatchStatus {
  const played = outcomes
    .filter((h) => h.outcome != null)
    .sort((a, b) => a.holeNumber - b.holeNumber);

  let diff = 0;
  for (const h of played) {
    if (h.outcome === "truffle") diff += 1;
    else if (h.outcome === "syndicate") diff -= 1;
    const remaining = totalHoles - h.holeNumber;
    // Closed out only when the lead exceeds the holes still to play (remaining>0);
    // a one-hole lead on the 18th is "1 up", handled by the all-played branch.
    if (remaining > 0 && Math.abs(diff) > remaining) {
      return {
        diff,
        holesDecided: played.length,
        lastHole: h.holeNumber,
        status: "final",
        winner: diff > 0 ? "truffle" : "syndicate",
        label: `${Math.abs(diff)}&${remaining}`,
        decidedAtHole: h.holeNumber,
      };
    }
  }

  const lastHole = played.length ? played[played.length - 1].holeNumber : 0;
  const allPlayed = played.length >= totalHoles;
  if (allPlayed) {
    return {
      diff,
      holesDecided: played.length,
      lastHole,
      status: "final",
      winner: diff === 0 ? "halved" : diff > 0 ? "truffle" : "syndicate",
      label: diff === 0 ? "AS" : `${Math.abs(diff)} up`,
      decidedAtHole: diff === 0 ? totalHoles : lastHole,
    };
  }

  return {
    diff,
    holesDecided: played.length,
    lastHole,
    status: "in_progress",
    winner: null,
    label: lastHole === 0 ? "" : diff === 0 ? `AS thru ${lastHole}` : `${Math.abs(diff)} up thru ${lastHole}`,
    decidedAtHole: null,
  };
}

export interface ComputeMatchArgs {
  truffleIndex: number | null;
  syndicateIndex: number | null;
  course: MatchCourse;
  holes: MatchHoleInput[];
  allowance?: number; // fraction of the CH difference, default 1 (100%)
}

/** Full match computation from per-hole grosses. */
export function computeMatch({
  truffleIndex,
  syndicateIndex,
  course,
  holes,
  allowance = 1,
}: ComputeMatchArgs): MatchResult {
  const chT = truffleIndex == null ? null : courseHandicapFor(truffleIndex, course);
  const chS = syndicateIndex == null ? null : courseHandicapFor(syndicateIndex, course);

  let strokesDiff = 0;
  let receiver: Side | null = null;
  if (chT != null && chS != null && chT !== chS) {
    strokesDiff = Math.round(Math.abs(chT - chS) * allowance);
    receiver = chT > chS ? "truffle" : "syndicate";
  }

  const holeResults: MatchHoleResult[] = holes
    .slice()
    .sort((a, b) => a.holeNumber - b.holeNumber)
    .map((h) => {
      const recStrokes = strokesOnHole(strokesDiff, h.strokeIndex);
      const truffleStrokes = receiver === "truffle" ? recStrokes : 0;
      const syndicateStrokes = receiver === "syndicate" ? recStrokes : 0;
      const truffleNet = h.truffleGross == null ? null : h.truffleGross - truffleStrokes;
      const syndicateNet = h.syndicateGross == null ? null : h.syndicateGross - syndicateStrokes;
      let outcome: HoleOutcome | null = null;
      if (truffleNet != null && syndicateNet != null) {
        outcome = truffleNet < syndicateNet ? "truffle" : syndicateNet < truffleNet ? "syndicate" : "tie";
      }
      return {
        holeNumber: h.holeNumber,
        strokeIndex: h.strokeIndex,
        truffleGross: h.truffleGross,
        syndicateGross: h.syndicateGross,
        truffleStrokes,
        syndicateStrokes,
        truffleNet,
        syndicateNet,
        outcome,
      };
    });

  const status = matchStatusFromOutcomes(holeResults);

  return {
    truffleCourseHandicap: chT,
    syndicateCourseHandicap: chS,
    strokesDiff,
    receiver,
    holes: holeResults,
    ...status,
  };
}
