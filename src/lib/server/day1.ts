"use server";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  day2Teams,
  players,
  seasons,
  segments,
  segmentScores,
} from "@/db/schema";
import { requireAdmin, requireAdminOrSelf } from "./auth-guards";
import { getActiveRoster } from "./players";
import { notifySeasonChange } from "./realtime";
import { getCurrentSeasonId } from "./seasons";
import { getSeasonScoring } from "./scoring";

const submitScoreSchema = z.object({
  playerId: z.number().int().positive(),
  grossScore: z.number().int().min(0),
});

const submitPickSchema = z.object({
  pickerPlayerId: z.number().int().positive(),
  pickedPlayerId: z.number().int().positive(),
});

export type LeaderboardRow = {
  id: number;
  name: string;
  photoUrl: string | null;
  handicap: number;
  grossScore: number;
  /** Day-1 (Friday) net — fractional. */
  netScore: number;
  rank: number;
};

/**
 * Day-1 leaderboard: players ranked by their Friday (day=1) segment net,
 * computed via the WHS engine (gross + course handicap from the season's
 * Bluewater segment and each player's season index).
 */
async function fetchRankedLeaderboard(
  seasonId: number,
): Promise<LeaderboardRow[]> {
  const scoring = await getSeasonScoring(seasonId);
  if (scoring.day1SegmentId == null) return [];

  const scored = [...scoring.byPlayer.values()].filter(
    (p) => p.day1Gross != null,
  );
  if (scored.length === 0) return [];

  const playerRows = await db
    .select({
      id: players.id,
      name: players.name,
      photoUrl: players.photoUrl,
      handicap: players.handicap,
    })
    .from(players);
  const pById = new Map(playerRows.map((p) => [p.id, p]));

  const rows = scored
    .map((s) => {
      const p = pById.get(s.playerId)!;
      const netScore = s.day1Net ?? s.day1Gross!;
      return {
        id: s.playerId,
        name: p.name,
        photoUrl: p.photoUrl,
        handicap: s.index ?? p.handicap,
        grossScore: s.day1Gross!,
        netScore,
      };
    })
    .sort((a, b) => a.netScore - b.netScore || a.grossScore - b.grossScore);

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getDay1Leaderboard(seasonId: number) {
  return fetchRankedLeaderboard(seasonId);
}

export async function getDay1Scores(seasonId: number) {
  const lb = await fetchRankedLeaderboard(seasonId);
  return lb.map((r) => ({
    playerId: r.id,
    grossScore: r.grossScore,
    netScore: r.netScore,
    name: r.name,
    handicap: r.handicap,
    photoUrl: r.photoUrl,
  }));
}

/** The season's Friday (day=1) segment, or null if none configured. */
async function getDay1Segment(seasonId: number) {
  const [seg] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.seasonId, seasonId), eq(segments.day, 1)))
    .orderBy(asc(segments.sortOrder))
    .limit(1);
  return seg ?? null;
}

/** Players (with season index) + the Friday segment, for the score-entry form. */
export async function getDay1ScoreEntry(seasonId: number) {
  const seg = await getDay1Segment(seasonId);
  const roster = await getActiveRoster(seasonId);
  return {
    segment: seg
      ? { id: seg.id, rating: seg.rating, slope: seg.slope, par: seg.par, holes: seg.holes }
      : null,
    players: roster.map((p) => ({
      id: p.id,
      name: p.name,
      photoUrl: p.photoUrl,
      index: p.handicap,
    })),
  };
}

export async function submitDay1Score(input: z.input<typeof submitScoreSchema>) {
  const data = submitScoreSchema.parse(input);
  await requireAdminOrSelf(data.playerId);
  const seasonId = await getCurrentSeasonId();

  const seg = await getDay1Segment(seasonId);
  if (!seg) throw new Error("No Day 1 round is configured for this season");

  const [row] = await db
    .insert(segmentScores)
    .values({ segmentId: seg.id, playerId: data.playerId, gross: data.grossScore })
    .onConflictDoUpdate({
      target: [segmentScores.segmentId, segmentScores.playerId],
      set: { gross: data.grossScore },
    })
    .returning();
  await notifySeasonChange(seasonId);
  return row;
}

export async function getDay1PicksOverview(seasonId: number) {
  const [state] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);
  const leaderboard = await fetchRankedLeaderboard(seasonId);
  const teams = await db
    .select()
    .from(day2Teams)
    .where(eq(day2Teams.seasonId, seasonId))
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
  const seasonId = await getCurrentSeasonId();

  // Rankings are derived from stable Day-1 nets; compute once, then mutate in a tx.
  const ranked = await fetchRankedLeaderboard(seasonId);
  const picker = ranked.find((r) => r.id === data.pickerPlayerId);
  const picked = ranked.find((r) => r.id === data.pickedPlayerId);
  if (!picker) throw new Error("Picker not on leaderboard");
  if (!picked) throw new Error("Picked player not on leaderboard");
  if (picked.rank < 11)
    throw new Error("Can only pick players ranked 11 or below");

  const result = await db.transaction(async (tx) => {
    const [state] = await tx
      .select()
      .from(seasons)
      .where(eq(seasons.id, seasonId))
      .limit(1);
    if (!state) throw new Error("Season not initialized");
    if (state.day1PickingComplete) throw new Error("Picking is already complete");
    if (picker.rank !== state.nextPickerRank)
      throw new Error("Not this player's turn to pick");

    const existingTeams = await tx
      .select({ player2Id: day2Teams.player2Id })
      .from(day2Teams)
      .where(eq(day2Teams.seasonId, seasonId));
    if (existingTeams.some((t) => t.player2Id === data.pickedPlayerId)) {
      throw new Error("Player already picked");
    }

    await tx.insert(day2Teams).values({
      seasonId,
      player1Id: data.pickerPlayerId,
      player2Id: data.pickedPlayerId,
      pickOrder: picker.rank,
      name: `Team ${21 - picker.rank}`,
    });

    const nextRank = picker.rank - 1;
    const allPicked = nextRank < 1;
    await tx
      .update(seasons)
      .set({
        // When the last picker (rank 1) has chosen, there's no next picker, but
        // the draft is NOT auto-locked — an admin locks it via
        // completePartnerDraft so the pairs can be reviewed first.
        nextPickerRank: allPicked ? null : nextRank,
        day1PickingStarted: true,
      })
      .where(eq(seasons.id, seasonId));

    return { allPicked };
  });
  await notifySeasonChange(seasonId);
  return result;
}

export async function completeDay1() {
  await requireAdmin();
  const seasonId = await getCurrentSeasonId();
  await db
    .update(seasons)
    .set({ day1Complete: true, currentDay: 1 })
    .where(eq(seasons.id, seasonId));
  await notifySeasonChange(seasonId);
  return { ok: true };
}

/**
 * Admin: close the partner draft. Picking also auto-completes when the last pick
 * (rank 1) is made; this lets an admin finalize it manually (e.g. a short field
 * where not every rank picks). Clears any pending picker turn.
 */
export async function completePartnerDraft() {
  await requireAdmin();
  const seasonId = await getCurrentSeasonId();
  await db
    .update(seasons)
    .set({
      day1PickingStarted: true,
      day1PickingComplete: true,
      nextPickerRank: null,
    })
    .where(eq(seasons.id, seasonId));
  await notifySeasonChange(seasonId);
  return { ok: true };
}

/**
 * Admin: undo the single MOST RECENT partner pick. Picking descends from rank 10
 * to 1, so the latest pick is the team with the smallest pickOrder. Reopens that
 * picker's turn. Call repeatedly to walk back further (sequential undo).
 */
export async function undoLastDay1Pick() {
  await requireAdmin();
  const seasonId = await getCurrentSeasonId();
  const result = await db.transaction(async (tx) => {
    const [last] = await tx
      .select()
      .from(day2Teams)
      .where(eq(day2Teams.seasonId, seasonId))
      .orderBy(asc(day2Teams.pickOrder)) // smallest pickOrder = most recent pick
      .limit(1);
    if (!last) throw new Error("No picks to undo.");

    await tx.delete(day2Teams).where(eq(day2Teams.id, last.id));

    const remaining = await tx
      .select({ id: day2Teams.id })
      .from(day2Teams)
      .where(eq(day2Teams.seasonId, seasonId));

    await tx
      .update(seasons)
      .set({
        nextPickerRank: last.pickOrder, // that picker is back on the clock
        day1PickingComplete: false,
        day1PickingStarted: remaining.length > 0,
      })
      .where(eq(seasons.id, seasonId));

    return { undonePickOrder: last.pickOrder };
  });
  await notifySeasonChange(seasonId);
  return result;
}
