/**
 * WHS course-handicap engine. Pure and framework-free so it can run identically on
 * the server (scoring/standings) and the client (live net preview).
 *
 * Course Handicap = Index × (Slope / 113) + (Course Rating − Par),
 * with the index halved and 9-hole rating/slope/par used for a single nine.
 *
 * Values are deliberately LEFT UNROUNDED — the Bayfield Open keeps full fractional
 * precision (a low index on a short nine can even produce a negative course handicap).
 * See docs/tournament-mechanics.md.
 */

export interface CourseHandicapInput {
  /** Handicap index (e.g. from The Grint). */
  index: number;
  /** Slope rating of the played tees for this segment. */
  slope: number;
  /** Course rating for the same holes as `holes`. */
  rating: number;
  /** Par for the same holes as `holes`. */
  par: number;
  /** 9 for a single nine (default), 18 for a full round. */
  holes?: 9 | 18;
}

/** Unrounded WHS course handicap for a segment. */
export function courseHandicap({
  index,
  slope,
  rating,
  par,
  holes = 9,
}: CourseHandicapInput): number {
  const indexFactor = holes === 9 ? 0.5 : 1;
  return index * indexFactor * (slope / 113) + (rating - par);
}

/** Net for a segment = gross − course handicap (unrounded). */
export function segmentNet(gross: number, ch: number): number {
  return gross - ch;
}

/**
 * A scored segment's WHS inputs. `rating`/`slope`/`par` may be null until sourced
 * (from The Grint or manual entry); net is only computable once they're present.
 */
export interface SegmentInputs {
  rating: number | null;
  slope: number | null;
  par: number | null;
  holes?: 9 | 18;
}

/**
 * Net for a player's gross on a segment, or null if the segment's WHS inputs aren't
 * known yet (so callers can show gross-only until course data lands).
 */
export function netForSegment(
  gross: number,
  index: number,
  seg: SegmentInputs,
): number | null {
  if (seg.rating == null || seg.slope == null || seg.par == null) return null;
  const ch = courseHandicap({
    index,
    slope: seg.slope,
    rating: seg.rating,
    par: seg.par,
    holes: seg.holes ?? 9,
  });
  return segmentNet(gross, ch);
}
