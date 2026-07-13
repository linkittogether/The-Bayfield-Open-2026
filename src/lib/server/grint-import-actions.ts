"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, players, segments } from "@/db/schema";
import { requireAdminOrSelf } from "./auth-guards";
import { fetchRounds } from "./grint-rounds";
import { matchSegment, type ImportSegment, type MatchedRound } from "./grint-import";

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
