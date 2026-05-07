"use server";

import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  day1Scores,
  day2Teams,
  players,
  tournamentState,
} from "@/db/schema";
import { requireAdmin, requireAdminOrSelf } from "./auth-guards";

const submitScoreSchema = z.object({
  playerId: z.number().int().positive(),
  grossScore: z.number().int().min(0),
});

const submitPickSchema = z.object({
  pickerPlayerId: z.number().int().positive(),
  pickedPlayerId: z.number().int().positive(),
});

type LeaderboardRow = {
  id: number;
  name: string;
  photoUrl: string | null;
  handicap: number;
  grossScore: number;
  netScore: number;
  rank: number;
};

async function fetchRankedLeaderboard(): Promise<LeaderboardRow[]> {
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      photoUrl: players.photoUrl,
      handicap: players.handicap,
      grossScore: day1Scores.grossScore,
      netScore: day1Scores.netScore,
      rank: sql<number>`ROW_NUMBER() OVER (ORDER BY ${day1Scores.netScore} ASC, ${day1Scores.grossScore} ASC)`.mapWith(
        Number,
      ),
    })
    .from(players)
    .innerJoin(day1Scores, eq(day1Scores.playerId, players.id))
    .orderBy(asc(day1Scores.netScore), asc(day1Scores.grossScore));
  return rows;
}

export async function getDay1Leaderboard() {
  return fetchRankedLeaderboard();
}

export async function getDay1Scores() {
  return db
    .select({
      id: day1Scores.id,
      playerId: day1Scores.playerId,
      grossScore: day1Scores.grossScore,
      netScore: day1Scores.netScore,
      name: players.name,
      handicap: players.handicap,
      photoUrl: players.photoUrl,
    })
    .from(day1Scores)
    .innerJoin(players, eq(players.id, day1Scores.playerId))
    .orderBy(asc(day1Scores.netScore));
}

export async function submitDay1Score(input: z.input<typeof submitScoreSchema>) {
  const data = submitScoreSchema.parse(input);
  await requireAdminOrSelf(data.playerId);

  const [player] = await db
    .select({ handicap: players.handicap })
    .from(players)
    .where(eq(players.id, data.playerId))
    .limit(1);
  if (!player) throw new Error("Player not found");

  const netScore = data.grossScore - Math.floor(player.handicap / 2);

  const [row] = await db
    .insert(day1Scores)
    .values({
      playerId: data.playerId,
      grossScore: data.grossScore,
      netScore,
    })
    .onConflictDoUpdate({
      target: day1Scores.playerId,
      set: { grossScore: data.grossScore, netScore },
    })
    .returning();
  return row;
}

export async function getDay1PicksOverview() {
  const [state] = await db
    .select()
    .from(tournamentState)
    .where(eq(tournamentState.id, 1))
    .limit(1);
  const leaderboard = await fetchRankedLeaderboard();
  const teams = await db
    .select()
    .from(day2Teams)
    .orderBy(asc(day2Teams.pickOrder));

  const nextPickerRank = state?.nextPickerRank ?? null;
  const nextPicker =
    nextPickerRank == null
      ? null
      : leaderboard.find((r) => r.rank === nextPickerRank) ?? null;

  const pickedIds = new Set(teams.map((t) => t.player2Id));
  const available = leaderboard.filter(
    (r) => r.rank >= 11 && !pickedIds.has(r.id),
  );

  return {
    state,
    leaderboard,
    teams,
    nextPicker,
    nextPickerRank,
    available,
    pickingComplete: state?.day1PickingComplete ?? false,
  };
}

export async function submitDay1Pick(input: z.input<typeof submitPickSchema>) {
  const data = submitPickSchema.parse(input);
  await requireAdminOrSelf(data.pickerPlayerId);

  return db.transaction(async (tx) => {
    const [state] = await tx
      .select()
      .from(tournamentState)
      .where(eq(tournamentState.id, 1))
      .limit(1);
    if (!state) throw new Error("Tournament state not initialized");
    if (state.day1PickingComplete) throw new Error("Picking is already complete");

    const ranked = await tx
      .select({
        id: players.id,
        rank: sql<number>`ROW_NUMBER() OVER (ORDER BY ${day1Scores.netScore} ASC, ${day1Scores.grossScore} ASC)`.mapWith(
          Number,
        ),
      })
      .from(players)
      .innerJoin(day1Scores, eq(day1Scores.playerId, players.id))
      .orderBy(asc(day1Scores.netScore), asc(day1Scores.grossScore));

    const picker = ranked.find((r) => r.id === data.pickerPlayerId);
    const picked = ranked.find((r) => r.id === data.pickedPlayerId);
    if (!picker) throw new Error("Picker not on leaderboard");
    if (!picked) throw new Error("Picked player not on leaderboard");
    if (picker.rank !== state.nextPickerRank)
      throw new Error("Not this player's turn to pick");
    if (picked.rank < 11)
      throw new Error("Can only pick players ranked 11 or below");

    const existingTeams = await tx
      .select({ player2Id: day2Teams.player2Id })
      .from(day2Teams);
    if (existingTeams.some((t) => t.player2Id === data.pickedPlayerId)) {
      throw new Error("Player already picked");
    }

    const teamName = `Team ${21 - picker.rank}`;
    await tx.insert(day2Teams).values({
      player1Id: data.pickerPlayerId,
      player2Id: data.pickedPlayerId,
      pickOrder: picker.rank,
      name: teamName,
    });

    const nextRank = picker.rank - 1;
    const pickingComplete = nextRank < 1;
    await tx
      .update(tournamentState)
      .set({
        nextPickerRank: pickingComplete ? null : nextRank,
        day1PickingStarted: true,
        day1PickingComplete: pickingComplete,
      })
      .where(eq(tournamentState.id, 1));

    return { pickingComplete };
  });
}

export async function completeDay1() {
  await requireAdmin();
  await db
    .update(tournamentState)
    .set({ day1Complete: true, currentDay: 1 })
    .where(eq(tournamentState.id, 1));
  return { ok: true };
}
