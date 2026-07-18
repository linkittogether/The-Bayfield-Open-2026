"use server";

import { aliasedTable, and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  day2Teams,
  players,
  seasonRosters,
  seasons,
  segments,
  segmentScores,
  teams,
} from "@/db/schema";
import { requireAdmin, requireAdminOrSelf } from "./auth-guards";
import { getActiveRoster } from "./players";
import { notifySeasonChange } from "./realtime";
import { getCurrentSeasonId } from "./seasons";
import { getSeasonScoring, getSegments } from "./scoring";

// A single player's gross on one stroke-play segment (own-ball, individual).
const submitSegmentSchema = z.object({
  playerId: z.number().int().positive(),
  segmentId: z.number().int().positive(),
  grossScore: z.number().int().min(0),
});

// teamName carries the team slug (same values the draft client already sends).
const draftPickSchema = z.object({
  playerId: z.number().int().positive(),
  teamName: z.enum(["truffle_hogs", "mycelium_syndicate"]),
  isCaptain: z.boolean().optional().default(false),
});

const p1 = aliasedTable(players, "p1");
const p2 = aliasedTable(players, "p2");

const teamWithPlayersColumns = {
  id: day2Teams.id,
  name: day2Teams.name,
  pickOrder: day2Teams.pickOrder,
  player1Id: p1.id,
  player1Name: p1.name,
  player1Handicap: p1.handicap,
  player1Photo: p1.photoUrl,
  player2Id: p2.id,
  player2Name: p2.name,
  player2Handicap: p2.handicap,
  player2Photo: p2.photoUrl,
};

/** The Friday-draft pairs for a season. */
export async function getDay2Teams(seasonId: number) {
  return db
    .select(teamWithPlayersColumns)
    .from(day2Teams)
    .innerJoin(p1, eq(p1.id, day2Teams.player1Id))
    .innerJoin(p2, eq(p2.id, day2Teams.player2Id))
    .where(eq(day2Teams.seasonId, seasonId))
    .orderBy(asc(day2Teams.pickOrder));
}

export interface Day2PairStanding {
  id: number;
  name: string | null;
  pickOrder: number;
  player1Id: number;
  player1Name: string;
  player1Handicap: number;
  player1Photo: string | null;
  player1Net: number | null;
  player1TotalGross: number | null;
  player1Day1Net: number | null;
  player1Day1Gross: number | null;
  player1Day2Nets: (number | null)[];
  player1Day2Grosses: (number | null)[];
  player2Id: number;
  player2Name: string;
  player2Handicap: number;
  player2Photo: string | null;
  player2Net: number | null;
  player2TotalGross: number | null;
  player2Day1Net: number | null;
  player2Day1Gross: number | null;
  player2Day2Nets: (number | null)[];
  player2Day2Grosses: (number | null)[];
  /** Column headers for the Day-2 segment nets (aligned to the *Day2Nets arrays). */
  day2SegLabels: string[];
  /** Sum of both partners' cumulative nets (Fri + Sat). Null until both have nets. */
  combinedNet: number | null;
  segmentsScored: number;
  /** True when BOTH partners have a score for every Day 1 + Day 2 stroke segment. */
  complete: boolean;
}

/**
 * Day-2 standings: the Friday-draft pairs ranked by combined cumulative net —
 * each partner's own-ball net across every stroke-play segment (Friday + Saturday),
 * summed. Lowest combined net wins.
 */
export async function getDay2Leaderboard(
  seasonId: number,
): Promise<Day2PairStanding[]> {
  const [pairs, scoring] = await Promise.all([
    getDay2Teams(seasonId),
    getSeasonScoring(seasonId),
  ]);

  // Stroke-play segments that count toward Day 2 standings (Day 1 + Day 2).
  // Day-3 match play has a segment for stroke allocation but never fills
  // segment_scores, so exclude it from the "all scored" check.
  const strokeSegCount = scoring.segments.filter((s) => s.day <= 2).length;

  // Day-2 segments become breakdown columns — the 9-hole round first, then the
  // 18 (fewest holes first), labelled by hole count. sortOrder is the tiebreak
  // if two segments share a hole count.
  const day2Segs = scoring.segments
    .filter((s) => s.day === 2)
    .sort((a, b) => a.holes - b.holes || a.sortOrder - b.sortOrder);
  const day2SegLabels = day2Segs.map((s) => `${s.holes}h`);

  const rows: Day2PairStanding[] = pairs.map((t) => {
    const s1 = scoring.byPlayer.get(t.player1Id);
    const s2 = scoring.byPlayer.get(t.player2Id);
    const n1 = s1?.cumulativeNet ?? null;
    const n2 = s2?.cumulativeNet ?? null;
    const combinedNet = n1 != null && n2 != null ? n1 + n2 : null;
    return {
      id: t.id,
      name: t.name,
      pickOrder: t.pickOrder,
      player1Id: t.player1Id,
      player1Name: t.player1Name,
      player1Handicap: s1?.index ?? t.player1Handicap,
      player1Photo: t.player1Photo,
      player1Net: n1,
      player1TotalGross: s1?.cumulativeGross ?? null,
      player1Day1Net: s1?.netByDay.get(1) ?? null,
      player1Day1Gross: s1?.day1Gross ?? null,
      player1Day2Nets: day2Segs.map((seg) => s1?.netBySegment.get(seg.id) ?? null),
      player1Day2Grosses: day2Segs.map((seg) => s1?.grossBySegment.get(seg.id) ?? null),
      player2Id: t.player2Id,
      player2Name: t.player2Name,
      player2Handicap: s2?.index ?? t.player2Handicap,
      player2Photo: t.player2Photo,
      player2Net: n2,
      player2TotalGross: s2?.cumulativeGross ?? null,
      player2Day1Net: s2?.netByDay.get(1) ?? null,
      player2Day1Gross: s2?.day1Gross ?? null,
      player2Day2Nets: day2Segs.map((seg) => s2?.netBySegment.get(seg.id) ?? null),
      player2Day2Grosses: day2Segs.map((seg) => s2?.grossBySegment.get(seg.id) ?? null),
      day2SegLabels,
      combinedNet,
      segmentsScored: (s1?.segmentsScored ?? 0) + (s2?.segmentsScored ?? 0),
      complete:
        strokeSegCount > 0 &&
        (s1?.segmentsScored ?? 0) >= strokeSegCount &&
        (s2?.segmentsScored ?? 0) >= strokeSegCount,
    };
  });

  rows.sort((a, b) => {
    if (a.combinedNet == null && b.combinedNet == null) return 0;
    if (a.combinedNet == null) return 1;
    if (b.combinedNet == null) return -1;
    return a.combinedNet - b.combinedNet;
  });
  return rows;
}

/** Segments, players (with season index), and existing grosses for score entry. */
export async function getDay2ScoreEntry(seasonId: number) {
  const segs = await getSegments(seasonId, 2);
  const roster = await getActiveRoster(seasonId);

  const scoreRows = await db
    .select({
      segmentId: segmentScores.segmentId,
      playerId: segmentScores.playerId,
      gross: segmentScores.gross,
    })
    .from(segmentScores)
    .innerJoin(segments, eq(segments.id, segmentScores.segmentId))
    .where(and(eq(segments.seasonId, seasonId), eq(segments.day, 2)));

  return {
    segments: segs,
    players: roster.map((p) => ({
      id: p.id,
      name: p.name,
      photoUrl: p.photoUrl,
      index: p.handicap,
    })),
    scores: scoreRows,
  };
}

/** Enter/overwrite a player's gross for one stroke-play segment (own ball). */
export async function submitSegmentScore(
  input: z.input<typeof submitSegmentSchema>,
) {
  const data = submitSegmentSchema.parse(input);
  await requireAdminOrSelf(data.playerId);
  const seasonId = await getCurrentSeasonId();

  const [seg] = await db
    .select({ seasonId: segments.seasonId })
    .from(segments)
    .where(eq(segments.id, data.segmentId))
    .limit(1);
  if (!seg) throw new Error("Unknown segment");
  if (seg.seasonId !== seasonId)
    throw new Error("Cannot score a segment from a past season");

  const [row] = await db
    .insert(segmentScores)
    .values({ segmentId: data.segmentId, playerId: data.playerId, gross: data.grossScore })
    .onConflictDoUpdate({
      target: [segmentScores.segmentId, segmentScores.playerId],
      set: { gross: data.grossScore },
    })
    .returning();
  await notifySeasonChange(seasonId);
  return row;
}

export async function getDay2DraftOverview(seasonId: number) {
  const [state] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);

  const standings = await getDay2Leaderboard(seasonId);
  const winners = standings
    .filter((s) => s.combinedNet != null)
    .slice(0, 2)
    .map((s) => ({
      teamId: s.id,
      player1Id: s.player1Id,
      player1Name: s.player1Name,
      player2Id: s.player2Id,
      player2Name: s.player2Name,
      totalNetScore: s.combinedNet as number,
    }));

  const allPlayers = await db
    .select({
      id: players.id,
      name: players.name,
      photoUrl: players.photoUrl,
      handicap: players.handicap,
    })
    .from(players)
    .orderBy(asc(players.name));

  const selected = await db
    .select({
      playerId: seasonRosters.playerId,
      teamName: teams.slug,
      isCaptain: seasonRosters.isCaptain,
      absent: seasonRosters.absent,
    })
    .from(seasonRosters)
    .innerJoin(teams, eq(teams.id, seasonRosters.teamId))
    .where(eq(seasonRosters.seasonId, seasonId));

  return { state, winners, allPlayers, selected };
}

export async function submitDay2DraftPick(
  input: z.input<typeof draftPickSchema>,
) {
  await requireAdmin();
  const data = draftPickSchema.parse(input);
  const seasonId = await getCurrentSeasonId();

  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.slug, data.teamName))
    .limit(1);
  if (!team) throw new Error("Unknown team");

  const [row] = await db
    .insert(seasonRosters)
    .values({
      seasonId,
      playerId: data.playerId,
      teamId: team.id,
      isCaptain: data.isCaptain,
    })
    .onConflictDoUpdate({
      target: [seasonRosters.seasonId, seasonRosters.playerId],
      set: { teamId: team.id, isCaptain: data.isCaptain },
    })
    .returning();
  await notifySeasonChange(seasonId);
  return row;
}

export async function removeDay2DraftPick(playerId: number) {
  await requireAdmin();
  const seasonId = await getCurrentSeasonId();
  const result = await db
    .delete(seasonRosters)
    .where(
      and(
        eq(seasonRosters.seasonId, seasonId),
        eq(seasonRosters.playerId, playerId),
      ),
    );
  await notifySeasonChange(seasonId);
  return { rowsAffected: result.count };
}

/**
 * Admin: close Day 2 stroke-play scoring. Independent of the Match Play Draft
 * (see completeDay2Draft) — this just records that the Pairs competition is final.
 */
export async function completeDay2() {
  await requireAdmin();
  const seasonId = await getCurrentSeasonId();
  await db
    .update(seasons)
    .set({ day2Complete: true, currentDay: 2 })
    .where(eq(seasons.id, seasonId));
  await notifySeasonChange(seasonId);
  return { ok: true };
}

export async function completeDay2Draft() {
  await requireAdmin();
  const seasonId = await getCurrentSeasonId();

  // Rule: every player who posted a Day-1 score this season must have a roster
  // entry (assigned or explicitly absent), and both teams need ≥1 active member.
  const scoring = await getSeasonScoring(seasonId);
  const scoredPlayerIds = [...scoring.byPlayer.values()]
    .filter((p) => p.day1Gross != null)
    .map((p) => p.playerId);

  const roster = await db
    .select({
      playerId: seasonRosters.playerId,
      teamId: seasonRosters.teamId,
      absent: seasonRosters.absent,
    })
    .from(seasonRosters)
    .where(eq(seasonRosters.seasonId, seasonId));

  const rosterByPlayer = new Map(roster.map((r) => [r.playerId, r]));
  const missing = scoredPlayerIds.filter((id) => !rosterByPlayer.has(id));
  if (missing.length) {
    throw new Error(
      `${missing.length} player(s) with a Day 1 score have no team assignment`,
    );
  }

  const activeByTeam = new Map<number, number>();
  for (const r of roster) {
    if (!r.absent) {
      activeByTeam.set(r.teamId, (activeByTeam.get(r.teamId) ?? 0) + 1);
    }
  }
  if (activeByTeam.size < 2 || [...activeByTeam.values()].some((n) => n < 1)) {
    throw new Error("Both teams need at least one active player");
  }

  await db
    .update(seasons)
    .set({ day2DraftComplete: true, currentDay: 2 })
    .where(eq(seasons.id, seasonId));
  await notifySeasonChange(seasonId);
  return { ok: true };
}
