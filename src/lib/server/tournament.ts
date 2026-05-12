"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  day1Scores,
  day2RoundScores,
  day2Teams,
  day3Holes,
  day3Matches,
  day3Players,
  tournamentState,
} from "@/db/schema";
import { requireAdmin } from "./auth-guards";

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
  .refine(
    (v) => Object.keys(v).length > 0,
    "At least one field is required",
  );

export async function getTournamentState() {
  const [row] = await db
    .select()
    .from(tournamentState)
    .where(eq(tournamentState.id, 1))
    .limit(1);
  return row ?? null;
}

export async function updateTournamentState(
  input: z.input<typeof updateSchema>,
) {
  await requireAdmin();
  const data = updateSchema.parse(input);
  const [row] = await db
    .update(tournamentState)
    .set(data)
    .where(eq(tournamentState.id, 1))
    .returning();
  return row;
}

export async function resetTournament() {
  await requireAdmin();
  await db.transaction(async (tx) => {
    await tx.delete(day3Holes);
    await tx.delete(day3Matches);
    await tx.delete(day3Players);
    await tx.delete(day2RoundScores);
    await tx.delete(day2Teams);
    await tx.delete(day1Scores);
    await tx
      .update(tournamentState)
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
      .where(eq(tournamentState.id, 1));
  });
  return { ok: true };
}
