"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, players, segments } from "@/db/schema";
import { requireAdmin, requireAdminOrSelf } from "./auth-guards";
import { fetchRounds } from "./grint-rounds";
import {
  getImportSegments,
  getRosterGrintIds,
  matchPlayerSegments,
  matchSegment,
  writeSegmentScore,
  type ImportSegment,
  type MatchedRound,
} from "./grint-import";
import { grintRefreshCount } from "./grint-rounds";
import { getActiveRoster } from "./players";
import { getCurrentSeasonId } from "./seasons";

/**
 * Client-callable action behind the "Pull from The Grint" button. Finds the
 * round(s) matching one segment (course + holes + date) for one player and
 * returns them for review — it does NOT write. The caller saves the chosen
 * gross through the normal submit path (submitDay1Score / submitSegmentScore),
 * which keeps the existing season/auth guards in charge of writes.
 */
export interface GrintPreview {
  status: "matched" | "none" | "ambiguous" | "no-course-id" | "no-grint";
  candidates: MatchedRound[];
}

export async function previewGrintScoreForSegment(input: {
  playerId: number;
  segmentId: number;
}): Promise<GrintPreview> {
  await requireAdminOrSelf(input.playerId);

  const [pl] = await db
    .select({ grintId: players.grintId })
    .from(players)
    .where(eq(players.id, input.playerId))
    .limit(1);
  if (!pl?.grintId) return { status: "no-grint", candidates: [] };

  const [seg] = await db
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
    .where(eq(segments.id, input.segmentId))
    .limit(1);
  if (!seg) return { status: "none", candidates: [] };

  const rounds = await fetchRounds(pl.grintId);
  const match = await matchSegment(rounds, seg as ImportSegment);
  return { status: match.status, candidates: match.candidates };
}

/**
 * Admin bulk pull: for one day of the CURRENT season, fetch every rostered
 * player's matching Grint round(s) and WRITE the gross for each unambiguous
 * match. Players without a Grint link, with no matching round, or with an
 * ambiguous match are reported so the admin can finish those by hand.
 */
export type BulkPullPlayerStatus =
  | "pulled"
  | "partial"
  | "none"
  | "ambiguous"
  | "no-grint";

export interface BulkPullSummary {
  day: number;
  written: number;
  segments: string[];
  perPlayer: { name: string; status: BulkPullPlayerStatus; note: string }[];
  refreshed: boolean;
}

export async function bulkPullDay(day: number): Promise<BulkPullSummary> {
  await requireAdmin();
  const refreshBefore = grintRefreshCount();
  const seasonId = await getCurrentSeasonId();
  const segs = await getImportSegments(seasonId, day);
  const roster = await getRosterGrintIds(seasonId);
  const active = await getActiveRoster(seasonId);
  const withGrint = new Set(roster.map((r) => r.playerId));

  let written = 0;
  const perPlayer: BulkPullSummary["perPlayer"] = [];

  // Modest concurrency: fetch a few players at a time to stay under function
  // time limits without hammering The Grint.
  const CONC = 5;
  for (let i = 0; i < roster.length; i += CONC) {
    const batch = roster.slice(i, i + CONC);
    const results = await Promise.all(
      batch.map(async (p) => {
        const matches = await matchPlayerSegments(p.grintId, segs);
        let got = 0;
        let amb = 0;
        const notes: string[] = [];
        for (const m of matches) {
          const cand = m.candidates[0];
          if (m.status === "matched" && cand?.gross != null) {
            await writeSegmentScore(m.segment.id, p.playerId, cand.gross);
            got += 1;
            notes.push(`${m.segment.label} ${cand.gross}`);
          } else if (m.status === "ambiguous") {
            amb += 1;
            notes.push(`${m.segment.label} ambiguous`);
          } else {
            notes.push(`${m.segment.label} —`);
          }
        }
        const status: BulkPullPlayerStatus =
          got === segs.length && segs.length > 0
            ? "pulled"
            : got > 0
              ? "partial"
              : amb > 0
                ? "ambiguous"
                : "none";
        return { name: p.name, status, note: notes.join(" · "), got };
      }),
    );
    for (const r of results) {
      written += r.got;
      perPlayer.push({ name: r.name, status: r.status, note: r.note });
    }
  }

  for (const a of active) {
    if (!withGrint.has(a.id)) {
      perPlayer.push({ name: a.name, status: "no-grint", note: "no Grint account linked" });
    }
  }

  return {
    day,
    written,
    segments: segs.map((s) => s.label),
    perPlayer,
    refreshed: grintRefreshCount() > refreshBefore,
  };
}
