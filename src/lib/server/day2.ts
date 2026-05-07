"use server";

import { aliasedTable, asc, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  day2RoundScores,
  day2Teams,
  day3Players,
  players,
  tournamentState,
} from "@/db/schema";
import { requireAdmin, requireAdminOrTeamMember } from "./auth-guards";

const submitRoundSchema = z.object({
  teamId: z.number().int().positive(),
  roundNumber: z.number().int().min(1).max(3),
  player1Gross: z.number().int().min(0),
  player2Gross: z.number().int().min(0),
});

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

export async function getDay2Teams() {
  return db
    .select(teamWithPlayersColumns)
    .from(day2Teams)
    .innerJoin(p1, eq(p1.id, day2Teams.player1Id))
    .innerJoin(p2, eq(p2.id, day2Teams.player2Id))
    .orderBy(asc(day2Teams.pickOrder));
}

export async function getDay2Leaderboard() {
  const teams = await db
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
    .groupBy(day2Teams.id, p1.id, p2.id)
    .orderBy(
      sql`COALESCE(SUM(${day2RoundScores.netScore}), 0) ASC`,
      sql`COUNT(${day2RoundScores.id}) DESC`,
    );

  // attach round details per team
  const allRounds = await db
    .select()
    .from(day2RoundScores)
    .orderBy(asc(day2RoundScores.teamId), asc(day2RoundScores.roundNumber));
  const byTeam = new Map<number, typeof allRounds>();
  for (const r of allRounds) {
    if (!byTeam.has(r.teamId)) byTeam.set(r.teamId, []);
    byTeam.get(r.teamId)!.push(r);
  }
  return teams.map((t) => ({
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

  const [team] = await db
    .select({
      h1: p1.handicap,
      h2: p2.handicap,
    })
    .from(day2Teams)
    .innerJoin(p1, eq(p1.id, day2Teams.player1Id))
    .innerJoin(p2, eq(p2.id, day2Teams.player2Id))
    .where(eq(day2Teams.id, data.teamId))
    .limit(1);
  if (!team) throw new Error("Team not found");

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

export async function getDay2DraftOverview() {
  const [state] = await db
    .select()
    .from(tournamentState)
    .where(eq(tournamentState.id, 1))
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

  const selected = await db.select().from(day3Players);

  return { state, winners, allPlayers, selected };
}

export async function submitDay2DraftPick(
  input: z.input<typeof draftPickSchema>,
) {
  await requireAdmin();
  const data = draftPickSchema.parse(input);
  const [row] = await db
    .insert(day3Players)
    .values({
      playerId: data.playerId,
      teamName: data.teamName,
      isCaptain: data.isCaptain,
    })
    .onConflictDoUpdate({
      target: day3Players.playerId,
      set: { teamName: data.teamName, isCaptain: data.isCaptain },
    })
    .returning();
  return row;
}

export async function removeDay2DraftPick(playerId: number) {
  await requireAdmin();
  const result = await db
    .delete(day3Players)
    .where(eq(day3Players.playerId, playerId));
  return { rowsAffected: result.count };
}

export async function completeDay2Draft() {
  await requireAdmin();
  const [{ total }] = await db
    .select({ total: count() })
    .from(day3Players);
  if (total !== 20) {
    throw new Error(`Need exactly 20 players assigned, currently ${total}`);
  }
  await db
    .update(tournamentState)
    .set({ day2Complete: true, day2DraftComplete: true, currentDay: 2 })
    .where(eq(tournamentState.id, 1));
  return { ok: true };
}
