"use server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { courseHoles, courses, segments } from "@/db/schema";
import { fetchCourseData, listCourseTees, type CourseTee } from "./grint-rounds";
import { requireAdmin } from "./auth-guards";
import { assertCurrentSeason } from "./seasons";

export interface SegmentSetup {
  segmentId: number;
  day: number;
  sortOrder: number;
  label: string;
  holes: number;
  tee: string | null;
  rating: number | null;
  slope: number | null;
  par: number | null;
  grintRound: string | null;
  courseName: string | null;
  grintCourseId: number | null;
  availableTees: CourseTee[];
}

/** Segments for a season + each course's selectable tees (from TheGrint). */
export async function getSeasonCourseSetup(seasonId: number): Promise<SegmentSetup[]> {
  const rows = await db
    .select({
      segmentId: segments.id,
      day: segments.day,
      sortOrder: segments.sortOrder,
      label: segments.label,
      holes: segments.holes,
      tee: segments.tee,
      rating: segments.rating,
      slope: segments.slope,
      par: segments.par,
      grintRound: segments.grintRound,
      courseName: courses.name,
      grintCourseId: courses.grintCourseId,
    })
    .from(segments)
    .leftJoin(courses, eq(segments.courseId, courses.id))
    .where(eq(segments.seasonId, seasonId))
    .orderBy(asc(segments.day), asc(segments.sortOrder));

  // Fetch each distinct course's tees once (best-effort — Grint may be down).
  const teeCache = new Map<number, CourseTee[]>();
  for (const r of rows) {
    if (r.grintCourseId != null && !teeCache.has(r.grintCourseId)) {
      try {
        teeCache.set(r.grintCourseId, await listCourseTees(r.grintCourseId));
      } catch {
        teeCache.set(r.grintCourseId, []);
      }
    }
  }

  return rows.map((r) => ({
    ...r,
    availableTees: r.grintCourseId != null ? (teeCache.get(r.grintCourseId) ?? []) : [],
  }));
}

const setTeeSchema = z.object({
  segmentId: z.number().int().positive(),
  tee: z.string().min(1),
});

/**
 * Change a segment's tee and re-pull its rating/slope/par (and, for 18-hole
 * segments, the per-hole stroke index) from TheGrint for that tee. Admin-only,
 * current season only.
 */
export async function setSegmentTee(input: z.input<typeof setTeeSchema>) {
  await requireAdmin();
  const data = setTeeSchema.parse(input);

  const [seg] = await db
    .select({
      seasonId: segments.seasonId,
      courseId: segments.courseId,
      holes: segments.holes,
      grintRound: segments.grintRound,
      grintCourseId: courses.grintCourseId,
    })
    .from(segments)
    .leftJoin(courses, eq(segments.courseId, courses.id))
    .where(eq(segments.id, data.segmentId))
    .limit(1);
  if (!seg) throw new Error("Unknown segment");
  await assertCurrentSeason(seg.seasonId);
  if (seg.grintCourseId == null) throw new Error("This course isn't mapped to TheGrint");

  const round = seg.grintRound ?? (seg.holes === 18 ? "18" : "F9");
  const cd = await fetchCourseData(seg.grintCourseId, data.tee, round);

  await db
    .update(segments)
    .set({ tee: data.tee, rating: cd.rating, slope: cd.slope, par: cd.par })
    .where(eq(segments.id, data.segmentId));

  if (seg.holes === 18 && seg.courseId) {
    for (const h of cd.holes) {
      await db
        .insert(courseHoles)
        .values({
          courseId: seg.courseId,
          tee: data.tee,
          holeNumber: h.holeNumber,
          par: h.par,
          strokeIndex: h.strokeIndex,
        })
        .onConflictDoUpdate({
          target: [courseHoles.courseId, courseHoles.tee, courseHoles.holeNumber],
          set: { par: h.par, strokeIndex: h.strokeIndex },
        });
    }
  }

  return { tee: data.tee, rating: cd.rating, slope: cd.slope, par: cd.par };
}
