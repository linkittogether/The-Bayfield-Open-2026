"use server";

import { aliasedTable, and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  day1Scores,
  day2RoundScores,
  day2Teams,
  players,
  seasonRosters,
  seasons,
  teams,
} from "@/db/schema";
import { requireAdmin, requireAdminOrTeamMember } from "./auth-guards";
import { getCurrentSeasonId } from "./seasons";

const submitRoundSchema = z.object({
  teamId: z.number().int().positive(),
  roundNumber: z.number().int().min(1).max(3),
  player1Gross: z.number().int().min(0),
  player2Gross: z.number().int().min(0),
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

export async function getDay2Teams(seasonId: number) {
  return db
    .select(teamWithPlayersColumns)
    .from(day2Teams)
    .innerJoin(p1, eq(p1.id, day2Teams.player1Id))
    .innerJoin(p2, eq(p2.id, day2Teams.player2Id))
    .where(eq(day2Teams.seasonId, seasonId))
    .orderBy(asc(day2Teams.pickOrder));
}

export async function getDay2Leaderboard(seasonId: number) {
  const teamRows = await db
    .select({
      ...teamWithPlayersColumns,
      totalNetScore: sql<number>`COALESCE(SUM(${day2RoundScores.netScore}), 0)`.mapWith(
        Number,
      ),
      roundsComplete: sql<number>`COUNT(${day2RoundScores.id})`.mapWith(Number),
    })
    .from(day2Teams)
    .innerJoin(p1, eq(p1.id, day2Teams.player1Id))
    .innerJoin(p2, eq(p2.id, day2Teams.player2Id))
    .leftJoin(day2RoundScores, eq(day2RoundScores.teamId, day2Teams.id))
    .where(eq(day2Teams.seasonId, seasonId))
    .groupBy(day2Teams.id, p1.id, p2.id)
    .orderBy(
      sql`COALESCE(SUM(${day2RoundScores.netScore}), 0) ASC`,
      sql`COUNT(${day2RoundScores.id}) DESC`,
    );

  // attach round details per team (scoped to this season's teams)
  const allRounds = await db
    .select({
      id: day2RoundScores.id,
      teamId: day2RoundScores.teamId,
      roundNumber: day2RoundScores.roundNumber,
      player1Gross: day2RoundScores.player1Gross,
      player2Gross: day2RoundScores.player2Gross,
      netScore: day2RoundScores.netScore,
    })
    .from(day2RoundScores)
    .innerJoin(day2Teams, eq(day2Teams.id, day2RoundScores.teamId))
    .where(eq(day2Teams.seasonId, seasonId))
    .orderBy(asc(day2RoundScores.teamId), asc(day2RoundScores.roundNumber));
  const byTeam = new Map<number, typeof allRounds>();
  for (const r of allRounds) {
    if (!byTeam.has(r.teamId)) byTeam.set(r.teamId, []);
    byTeam.get(r.teamId)!.push(r);
  }
  return teamRows.map((t) => ({
    ...t,
    roundScores: byTeam.get(t.id) ?? [],
  }));
}

export async function getDay2TeamScores(teamId: number) {
  return db
    .select()
    .from(day2RoundScores)
    .where(eq(day2RoundScores.teamId, teamId))
    .orderBy(asc(day2RoundScores.roundNumber));
}

export async function submitDay2RoundScore(
  input: z.input<typeof submitRoundSchema>,
) {
  const data = submitRoundSchema.parse(input);
  await requireAdminOrTeamMember(data.teamId);
  const seasonId = await getCurrentSeasonId();

  const [team] = await db
    .select({
      h1: p1.handicap,
      h2: p2.handicap,
      seasonId: day2Teams.seasonId,
    })
    .from(day2Teams)
    .innerJoin(p1, eq(p1.id, day2Teams.player1Id))
    .innerJoin(p2, eq(p2.id, day2Teams.player2Id))
    .where(eq(day2Teams.id, data.teamId))
    .limit(1);
  if (!team) throw new Error("Team not found");
  if (team.seasonId !== seasonId)
    throw new Error("Cannot score a team from a past season");

  const net1 = data.player1Gross - Math.floor(team.h1 / 2);
  const net2 = data.player2Gross - Math.floor(team.h2 / 2);
  const netScore = net1 + net2;

  const [row] = await db
    .insert(day2RoundScores)
    .values({
      teamId: data.teamId,
      roundNumber: data.roundNumber,
      player1Gross: data.player1Gross,
      player2Gross: data.player2Gross,
      netScore,
    })
    .onConflictDoUpdate({
      target: [day2RoundScores.teamId, day2RoundScores.roundNumber],
      set: {
        player1Gross: data.player1Gross,
        player2Gross: data.player2Gross,
        netScore,
      },
    })
    .returning();
  return row;
}

export async function getDay2DraftOverview(seasonId: number) {
  const [state] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);

  const winners = await db
    .select({
      teamId: day2Teams.id,
      player1Id: p1.id,
      player1Name: p1.name,
      player2Id: p2.id,
      player2Name: p2.name,
      totalNetScore: sql<number>`COALESCE(SUM(${day2RoundScores.netScore}), 0)`.mapWith(
        Number,
      ),
    })
    .from(day2Teams)
    .innerJoin(p1, eq(p1.id, day2Teams.player1Id))
    .innerJoin(p2, eq(p2.id, day2Teams.player2Id))
    .leftJoin(day2RoundScores, eq(day2RoundScores.teamId, day2Teams.id))
    .where(eq(day2Teams.seasonId, seasonId))
    .groupBy(day2Teams.id, p1.id, p1.name, p2.id, p2.name)
    .orderBy(sql`COALESCE(SUM(${day2RoundScores.netScore}), 0) ASC`)
    .limit(2);

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
  return { rowsAffected: result.count };
}

export async function completeDay2Draft() {
  await requireAdmin();
  const seasonId = await getCurrentSeasonId();

  // Rule: every player who posted a Day-1 score this season must have a roster
  // entry (either assigned to a team or explicitly marked absent), and both
  // teams must have at least one active (non-absent) member.
  const scored = await db
    .select({ playerId: day1Scores.playerId })
    .from(day1Scores)
    .where(eq(day1Scores.seasonId, seasonId));
  const roster = await db
    .select({
      playerId: seasonRosters.playerId,
      teamId: seasonRosters.teamId,
      absent: seasonRosters.absent,
    })
    .from(seasonRosters)
    .where(eq(seasonRosters.seasonId, seasonId));

  const rosterByPlayer = new Map(roster.map((r) => [r.playerId, r]));
  const missing = scored.filter((s) => !rosterByPlayer.has(s.playerId));
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
    .set({ day2Complete: true, day2DraftComplete: true, currentDay: 2 })
    .where(eq(seasons.id, seasonId));
  return { ok: true };
}
