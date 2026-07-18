"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  day2Teams,
  day3Holes,
  day3Matches,
  seasons,
  segmentScores,
  segments,
} from "@/db/schema";
import { requireAdmin } from "./auth-guards";
import { notifySeasonChange } from "./realtime";
import { assertCurrentSeason } from "./seasons";

const updateSchema = z
  .object({
    currentDay: z.number().int().optional(),
    day1Complete: z.boolean().optional(),
    day1PickingStarted: z.boolean().optional(),
    day1PickingComplete: z.boolean().optional(),
    day2Complete: z.boolean().optional(),
    day2DraftComplete: z.boolean().optional(),
    day3Complete: z.boolean().optional(),
    nextPickerRank: z.number().int().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");

/** The tournament state now lives on the seasons row. */
export async function getSeasonState(seasonId: number) {
  const [row] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);
  return row ?? null;
}

export async function updateSeasonState(
  seasonId: number,
  input: z.input<typeof updateSchema>,
) {
  await requireAdmin();
  await assertCurrentSeason(seasonId);
  const data = updateSchema.parse(input);
  const [row] = await db
    .update(seasons)
    .set(data)
    .where(eq(seasons.id, seasonId))
    .returning();
  await notifySeasonChange(seasonId);
  return row;
}

/**
 * Clears a season's results back to a fresh state: deletes all stroke-play
 * scores, Day 3 per-hole match results, partner pairings, and match-play
 * matchups, then resets the season's day/completion flags. Team rosters
 * (season_rosters) and players are preserved. Cannot be undone.
 *
 * Only allowed on the CURRENT season — assertCurrentSeason blocks past
 * seasons even if the action is invoked directly.
 */
export async function resetSeason(seasonId: number) {
  await requireAdmin();
  await assertCurrentSeason(seasonId);
  await db.transaction(async (tx) => {
    const matchIds = tx
      .select({ id: day3Matches.id })
      .from(day3Matches)
      .where(eq(day3Matches.seasonId, seasonId));
    await tx.delete(day3Holes).where(inArray(day3Holes.matchId, matchIds));
    await tx.delete(day3Matches).where(eq(day3Matches.seasonId, seasonId));

    await tx.delete(day2Teams).where(eq(day2Teams.seasonId, seasonId));

    // Stroke-play scores now live in segment_scores (scoped via their segment).
    const segIds = tx
      .select({ id: segments.id })
      .from(segments)
      .where(eq(segments.seasonId, seasonId));
    await tx.delete(segmentScores).where(inArray(segmentScores.segmentId, segIds));

    // Team rosters (season_rosters) are intentionally KEPT.

    await tx
      .update(seasons)
      .set({
        currentDay: 1,
        day1Complete: false,
        day1PickingStarted: false,
        day1PickingComplete: false,
        day2Complete: false,
        day2DraftComplete: false,
        day3Complete: false,
        nextPickerRank: 10,
      })
      .where(eq(seasons.id, seasonId));
  });
  await notifySeasonChange(seasonId);
  return { ok: true };
}
