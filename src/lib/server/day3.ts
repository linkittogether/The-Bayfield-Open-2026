"use server";

import { aliasedTable, and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  day3Holes,
  day3Matches,
  players,
  seasonRosters,
  seasons,
  teams,
} from "@/db/schema";
import { requireAdmin, requireAdminOrMatchPlayer } from "./auth-guards";
import { getCurrentSeasonId } from "./seasons";

const matchInputSchema = z.object({
  matchNumber: z.number().int().positive(),
  trufflePlayerId: z.number().int().positive(),
  syndicatePlayerId: z.number().int().positive(),
});

const setMatchesSchema = z.object({
  matches: z.array(matchInputSchema).min(1),
});

const submitHoleSchema = z.object({
  matchId: z.number().int().positive(),
  holeNumber: z.number().int().min(1).max(18),
  winner: z.enum(["truffle_hogs", "mycelium_syndicate", "tie"]),
});

const tp = aliasedTable(players, "tp");
const sp = aliasedTable(players, "sp");

export async function getDay3Teams(seasonId: number) {
  const rows = await db
    .select({
      teamName: teams.slug,
      isCaptain: seasonRosters.isCaptain,
      absent: seasonRosters.absent,
      playerId: players.id,
      name: players.name,
      photoUrl: players.photoUrl,
      handicap: players.handicap,
    })
    .from(seasonRosters)
    .innerJoin(teams, eq(teams.id, seasonRosters.teamId))
    .innerJoin(players, eq(players.id, seasonRosters.playerId))
    .where(eq(seasonRosters.seasonId, seasonId))
    .orderBy(
      asc(teams.slug),
      sql`${seasonRosters.isCaptain} DESC`,
      asc(players.name),
    );

  const truffleHogs = rows.filter((r) => r.teamName === "truffle_hogs");
  const myceliumSyndicate = rows.filter(
    (r) => r.teamName === "mycelium_syndicate",
  );
  return { truffleHogs, myceliumSyndicate };
}

export async function getDay3Matches(seasonId: number) {
  return db
    .select({
      id: day3Matches.id,
      matchNumber: day3Matches.matchNumber,
      trufflePlayerId: tp.id,
      trufflePlayerName: tp.name,
      trufflePhoto: tp.photoUrl,
      syndicatePlayerId: sp.id,
      syndicatePlayerName: sp.name,
      syndicatePhoto: sp.photoUrl,
      holesPlayed: sql<number>`(SELECT COUNT(*) FROM ${day3Holes} h WHERE h.match_id = ${day3Matches.id})`.mapWith(
        Number,
      ),
      truffleHolesWon: sql<number>`(SELECT COUNT(*) FROM ${day3Holes} h WHERE h.match_id = ${day3Matches.id} AND h.winner = 'truffle_hogs')`.mapWith(
        Number,
      ),
      syndicateHolesWon: sql<number>`(SELECT COUNT(*) FROM ${day3Holes} h WHERE h.match_id = ${day3Matches.id} AND h.winner = 'mycelium_syndicate')`.mapWith(
        Number,
      ),
      tiedHoles: sql<number>`(SELECT COUNT(*) FROM ${day3Holes} h WHERE h.match_id = ${day3Matches.id} AND h.winner = 'tie')`.mapWith(
        Number,
      ),
    })
    .from(day3Matches)
    .innerJoin(tp, eq(tp.id, day3Matches.trufflePlayerId))
    .innerJoin(sp, eq(sp.id, day3Matches.syndicatePlayerId))
    .where(eq(day3Matches.seasonId, seasonId))
    .orderBy(asc(day3Matches.matchNumber));
}

export async function getDay3Match(id: number) {
  const [match] = await db
    .select({
      id: day3Matches.id,
      matchNumber: day3Matches.matchNumber,
      trufflePlayerId: tp.id,
      trufflePlayerName: tp.name,
      trufflePhoto: tp.photoUrl,
      syndicatePlayerId: sp.id,
      syndicatePlayerName: sp.name,
      syndicatePhoto: sp.photoUrl,
    })
    .from(day3Matches)
    .innerJoin(tp, eq(tp.id, day3Matches.trufflePlayerId))
    .innerJoin(sp, eq(sp.id, day3Matches.syndicatePlayerId))
    .where(eq(day3Matches.id, id))
    .limit(1);
  if (!match) return null;
  const holes = await db
    .select()
    .from(day3Holes)
    .where(eq(day3Holes.matchId, id))
    .orderBy(asc(day3Holes.holeNumber));
  return { ...match, holes };
}

export async function setDay3Matches(input: z.input<typeof setMatchesSchema>) {
  await requireAdmin();
  const data = setMatchesSchema.parse(input);
  const seasonId = await getCurrentSeasonId();
  return db.transaction(async (tx) => {
    const matchIds = tx
      .select({ id: day3Matches.id })
      .from(day3Matches)
      .where(eq(day3Matches.seasonId, seasonId));
    await tx.delete(day3Holes).where(inArray(day3Holes.matchId, matchIds));
    await tx.delete(day3Matches).where(eq(day3Matches.seasonId, seasonId));
    const inserted = await tx
      .insert(day3Matches)
      .values(data.matches.map((m) => ({ ...m, seasonId })))
      .returning();
    return inserted;
  });
}

export async function submitDay3Hole(input: z.input<typeof submitHoleSchema>) {
  const data = submitHoleSchema.parse(input);
  await requireAdminOrMatchPlayer(data.matchId);
  const seasonId = await getCurrentSeasonId();
  const [match] = await db
    .select({ seasonId: day3Matches.seasonId })
    .from(day3Matches)
    .where(eq(day3Matches.id, data.matchId))
    .limit(1);
  if (!match || match.seasonId !== seasonId)
    throw new Error("Cannot score a match from a past season");

  const [row] = await db
    .insert(day3Holes)
    .values({
      matchId: data.matchId,
      holeNumber: data.holeNumber,
      winner: data.winner,
    })
    .onConflictDoUpdate({
      target: [day3Holes.matchId, day3Holes.holeNumber],
      set: { winner: data.winner },
    })
    .returning();
  return row;
}

export async function deleteDay3Hole(matchId: number, holeNumber: number) {
  await requireAdminOrMatchPlayer(matchId);
  const seasonId = await getCurrentSeasonId();
  const [match] = await db
    .select({ seasonId: day3Matches.seasonId })
    .from(day3Matches)
    .where(eq(day3Matches.id, matchId))
    .limit(1);
  if (!match || match.seasonId !== seasonId)
    throw new Error("Cannot modify a match from a past season");

  const result = await db
    .delete(day3Holes)
    .where(
      and(eq(day3Holes.matchId, matchId), eq(day3Holes.holeNumber, holeNumber)),
    );
  return { rowsAffected: result.count };
}

export async function getDay3Leaderboard(seasonId: number) {
  const perMatch = await db
    .select({
      id: day3Matches.id,
      matchNumber: day3Matches.matchNumber,
      truffleName: tp.name,
      syndicateName: sp.name,
      truffleHoles: sql<number>`COALESCE(SUM(CASE WHEN ${day3Holes.winner} = 'truffle_hogs' THEN 1 ELSE 0 END), 0)`.mapWith(
        Number,
      ),
      syndicateHoles: sql<number>`COALESCE(SUM(CASE WHEN ${day3Holes.winner} = 'mycelium_syndicate' THEN 1 ELSE 0 END), 0)`.mapWith(
        Number,
      ),
      ties: sql<number>`COALESCE(SUM(CASE WHEN ${day3Holes.winner} = 'tie' THEN 1 ELSE 0 END), 0)`.mapWith(
        Number,
      ),
      holesPlayed: sql<number>`COUNT(${day3Holes.id})`.mapWith(Number),
    })
    .from(day3Matches)
    .innerJoin(tp, eq(tp.id, day3Matches.trufflePlayerId))
    .innerJoin(sp, eq(sp.id, day3Matches.syndicatePlayerId))
    .leftJoin(day3Holes, eq(day3Holes.matchId, day3Matches.id))
    .where(eq(day3Matches.seasonId, seasonId))
    .groupBy(day3Matches.id, tp.name, sp.name)
    .orderBy(asc(day3Matches.matchNumber));

  let truffleMatchWins = 0;
  let syndicateMatchWins = 0;
  let tiedMatches = 0;
  let truffleTotalHoles = 0;
  let syndicateTotalHoles = 0;

  for (const m of perMatch) {
    truffleTotalHoles += m.truffleHoles;
    syndicateTotalHoles += m.syndicateHoles;
    if (m.truffleHoles > m.syndicateHoles) truffleMatchWins += 1;
    else if (m.syndicateHoles > m.truffleHoles) syndicateMatchWins += 1;
    else if (m.holesPlayed === 18) tiedMatches += 1;
  }

  return {
    summary: {
      truffleMatchWins,
      syndicateMatchWins,
      tiedMatches,
      truffleTotalHoles,
      syndicateTotalHoles,
    },
    matches: perMatch,
  };
}

export async function completeDay3() {
  await requireAdmin();
  const seasonId = await getCurrentSeasonId();
  await db
    .update(seasons)
    .set({ day3Complete: true, currentDay: 3 })
    .where(eq(seasons.id, seasonId));
  return { ok: true };
}
