import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { segmentScores, segments, seasonRosters } from "@/db/schema";
import { netForSegment } from "@/lib/handicap";

export interface SegmentDef {
  id: number;
  day: number;
  sortOrder: number;
  label: string;
  holes: number;
  rating: number | null;
  slope: number | null;
  par: number | null;
}

export interface PlayerScore {
  playerId: number;
  index: number | null;
  day1Gross: number | null;
  day1Net: number | null;
  cumulativeGross: number;
  /** Sum of computable segment nets (null if none computable yet). Fractional. */
  cumulativeNet: number | null;
  segmentsScored: number;
  /** True when every scored segment had the course data needed to compute net. */
  netComplete: boolean;
}

export interface SeasonScoring {
  segments: SegmentDef[];
  day1SegmentId: number | null;
  byPlayer: Map<number, PlayerScore>;
}

/**
 * Loads a season's stroke-play segments + per-player gross + per-season handicap
 * index, and computes each player's per-segment and cumulative net via the WHS
 * engine (src/lib/handicap.ts). Net is always computed here, never stored.
 */
export async function getSeasonScoring(seasonId: number): Promise<SeasonScoring> {
  const segs = (await db
    .select({
      id: segments.id,
      day: segments.day,
      sortOrder: segments.sortOrder,
      label: segments.label,
      holes: segments.holes,
      rating: segments.rating,
      slope: segments.slope,
      par: segments.par,
    })
    .from(segments)
    .where(eq(segments.seasonId, seasonId))
    .orderBy(asc(segments.day), asc(segments.sortOrder))) as SegmentDef[];

  const scoreRows = await db
    .select({
      segmentId: segmentScores.segmentId,
      playerId: segmentScores.playerId,
      gross: segmentScores.gross,
    })
    .from(segmentScores)
    .innerJoin(segments, eq(segments.id, segmentScores.segmentId))
    .where(eq(segments.seasonId, seasonId));

  const idxRows = await db
    .select({ playerId: seasonRosters.playerId, index: seasonRosters.handicapIndex })
    .from(seasonRosters)
    .where(eq(seasonRosters.seasonId, seasonId));

  const segById = new Map(segs.map((s) => [s.id, s]));
  const day1Seg = segs.find((s) => s.day === 1) ?? null;
  const idxByPlayer = new Map(idxRows.map((r) => [r.playerId, r.index]));

  const byPlayer = new Map<number, PlayerScore>();
  for (const sc of scoreRows) {
    const seg = segById.get(sc.segmentId)!;
    const index = idxByPlayer.get(sc.playerId) ?? null;
    const net =
      index == null
        ? null
        : netForSegment(sc.gross, index, {
            rating: seg.rating,
            slope: seg.slope,
            par: seg.par,
            holes: seg.holes as 9 | 18,
          });

    let ps = byPlayer.get(sc.playerId);
    if (!ps) {
      ps = {
        playerId: sc.playerId,
        index,
        day1Gross: null,
        day1Net: null,
        cumulativeGross: 0,
        cumulativeNet: null,
        segmentsScored: 0,
        netComplete: true,
      };
      byPlayer.set(sc.playerId, ps);
    }
    ps.cumulativeGross += sc.gross;
    ps.segmentsScored += 1;
    if (net == null) ps.netComplete = false;
    else ps.cumulativeNet = (ps.cumulativeNet ?? 0) + net;
    if (day1Seg && sc.segmentId === day1Seg.id) {
      ps.day1Gross = sc.gross;
      ps.day1Net = net;
    }
  }

  return { segments: segs, day1SegmentId: day1Seg?.id ?? null, byPlayer };
}

/** The season's stroke-play segments, ordered (optionally filtered to a day). */
export async function getSegments(
  seasonId: number,
  day?: number,
): Promise<SegmentDef[]> {
  const { segments: segs } = await getSeasonScoring(seasonId);
  return day == null ? segs : segs.filter((s) => s.day === day);
}
