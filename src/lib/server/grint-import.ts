import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { courses, players, seasonRosters, segmentScores, segments } from "@/db/schema";
import { fetchRounds, fetchScoreDetail, type GrintRound } from "./grint-rounds";

/**
 * Maps a season's segments to TheGrint rounds and pulls grosses. The "what to
 * pull" is driven entirely by each season's segment config (course + holes +
 * date) — see scripts/setup-season.ts. Shared by the batch importer
 * (scripts/grint-import.ts) and the per-player "pull my round" server action.
 *
 * NOTE: this is a plain server module (no "use server") so it can export the
 * pure matching helpers used by scripts. The client-callable actions live in
 * grint-import-actions.ts.
 */

export interface ImportSegment {
  id: number;
  day: number;
  sortOrder: number;
  label: string;
  holes: number;
  date: string | null;
  grintCourseId: number | null;
  courseName: string | null;
}

/** A segment's config joined with its course's Grint id, ordered for display. */
export async function getImportSegments(
  seasonId: number,
  day?: number,
): Promise<ImportSegment[]> {
  const where = day
    ? and(eq(segments.seasonId, seasonId), eq(segments.day, day))
    : eq(segments.seasonId, seasonId);
  const rows = await db
    .select({
      id: segments.id,
      day: segments.day,
      sortOrder: segments.sortOrder,
      label: segments.label,
      holes: segments.holes,
      date: segments.date,
      grintCourseId: courses.grintCourseId,
      courseName: courses.name,
    })
    .from(segments)
    .leftJoin(courses, eq(segments.courseId, courses.id))
    .where(where)
    .orderBy(segments.day, segments.sortOrder);
  return rows;
}

/** Active (non-absent) roster members who have a linked Grint account. */
export async function getRosterGrintIds(
  seasonId: number,
): Promise<{ playerId: number; name: string; grintId: number }[]> {
  const rows = await db
    .select({ playerId: players.id, name: players.name, grintId: players.grintId })
    .from(seasonRosters)
    .innerJoin(players, eq(seasonRosters.playerId, players.id))
    .where(
      and(
        eq(seasonRosters.seasonId, seasonId),
        eq(seasonRosters.absent, false),
        isNotNull(players.grintId),
      ),
    );
  return rows.map((r) => ({ playerId: r.playerId, name: r.name, grintId: r.grintId as number }));
}

export interface MatchedRound {
  scoreId: string;
  isoDate: string;
  displayDate: string;
  gross: number | null;
  holes: number;
  courseName: string;
  teeLabel: string;
  rating: number | null;
  slope: number | null;
  courseHandicap: number | null;
}

export type MatchStatus = "matched" | "none" | "ambiguous" | "no-course-id";

export interface SegmentMatch {
  segment: ImportSegment;
  status: MatchStatus;
  candidates: MatchedRound[]; // 0 (none), 1 (matched), or >1 (ambiguous)
}

/**
 * Find the round(s) in `rounds` that satisfy a segment: same hole count, same
 * date (when the segment has one), and — confirmed via a detail fetch — the same
 * Grint course. Detail is only fetched for the (few) rough candidates.
 */
export async function matchSegment(
  rounds: GrintRound[],
  seg: ImportSegment,
): Promise<SegmentMatch> {
  if (!seg.grintCourseId) return { segment: seg, status: "no-course-id", candidates: [] };

  const rough = rounds.filter(
    (r) => r.holes === seg.holes && (seg.date ? r.isoDate === seg.date : true),
  );

  const candidates: MatchedRound[] = [];
  for (const r of rough) {
    const d = await fetchScoreDetail(r.scoreId, { holes: r.holes });
    if (d.ok && d.courseId && Number(d.courseId) === seg.grintCourseId) {
      candidates.push({
        scoreId: r.scoreId,
        isoDate: r.isoDate,
        displayDate: r.date,
        gross: r.gross,
        holes: r.holes,
        courseName: r.course,
        teeLabel: r.teeLabel,
        rating: d.rating ?? null,
        slope: d.slope ?? null,
        courseHandicap: d.courseHandicap ?? null,
      });
    }
  }

  const status: MatchStatus =
    candidates.length === 0 ? "none" : candidates.length === 1 ? "matched" : "ambiguous";
  return { segment: seg, status, candidates };
}

/** Match every requested segment for one player (fetches their rounds once). */
export async function matchPlayerSegments(
  grintId: number,
  segs: ImportSegment[],
): Promise<SegmentMatch[]> {
  const rounds = await fetchRounds(grintId);
  const out: SegmentMatch[] = [];
  for (const seg of segs) out.push(await matchSegment(rounds, seg));
  return out;
}

/** Guard-free upsert of a gross into segment_scores (for the admin batch path). */
export async function writeSegmentScore(
  segmentId: number,
  playerId: number,
  gross: number,
): Promise<void> {
  await db
    .insert(segmentScores)
    .values({ segmentId, playerId, gross })
    .onConflictDoUpdate({
      target: [segmentScores.segmentId, segmentScores.playerId],
      set: { gross },
    });
}
