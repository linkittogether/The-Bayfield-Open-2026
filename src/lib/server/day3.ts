"use server";

import { aliasedTable, and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  courseHoles,
  day3Holes,
  day3Matches,
  players,
  seasonRosters,
  seasons,
  segments,
  teams,
} from "@/db/schema";
import {
  computeMatch,
  matchStatusFromOutcomes,
  type HoleOutcome,
  type MatchHoleInput,
} from "@/lib/matchplay";
import { fetchHoleScores, fetchRounds } from "./grint-rounds";
import { getImportSegments, matchSegment } from "./grint-import";
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

// Full-auto scoring: enter each player's gross on a hole; the net winner is computed.
const submitHoleSchema = z.object({
  matchId: z.number().int().positive(),
  holeNumber: z.number().int().min(1).max(18),
  trufflePlayerGross: z.number().int().min(1).max(30),
  syndicatePlayerGross: z.number().int().min(1).max(30),
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

// ── Match resolution (grosses → net → match play), with 2025 winner fallback ──

const OUTCOME_FROM_WINNER: Record<string, HoleOutcome> = {
  truffle_hogs: "truffle",
  mycelium_syndicate: "syndicate",
  tie: "tie",
};

/** The season's Sunday (day=3) course: rating/slope/par + per-hole stroke index. */
async function getMatchCourseContext(seasonId: number) {
  const [seg] = await db
    .select({
      courseId: segments.courseId,
      tee: segments.tee,
      rating: segments.rating,
      slope: segments.slope,
      par: segments.par,
    })
    .from(segments)
    .where(and(eq(segments.seasonId, seasonId), eq(segments.day, 3)))
    .limit(1);

  const strokeIndex = new Map<number, number>();
  const holeList: { holeNumber: number; strokeIndex: number | null; par: number | null }[] = [];
  if (seg?.courseId && seg.tee) {
    const holes = await db
      .select({
        holeNumber: courseHoles.holeNumber,
        strokeIndex: courseHoles.strokeIndex,
        par: courseHoles.par,
      })
      .from(courseHoles)
      .where(and(eq(courseHoles.courseId, seg.courseId), eq(courseHoles.tee, seg.tee)))
      .orderBy(asc(courseHoles.holeNumber));
    for (const h of holes) {
      if (h.strokeIndex != null) strokeIndex.set(h.holeNumber, h.strokeIndex);
      holeList.push(h);
    }
  }
  return {
    course: { rating: seg?.rating ?? null, slope: seg?.slope ?? null, par: seg?.par ?? null },
    strokeIndex,
    holeList,
  };
}

/** Per-season handicap index by player (season index, falling back to current). */
async function getSeasonIndexByPlayer(seasonId: number) {
  const rows = await db
    .select({
      playerId: seasonRosters.playerId,
      idx: seasonRosters.handicapIndex,
      hcp: players.handicap,
    })
    .from(seasonRosters)
    .innerJoin(players, eq(players.id, seasonRosters.playerId))
    .where(eq(seasonRosters.seasonId, seasonId));
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.playerId, r.idx ?? r.hcp);
  return map;
}

type MatchCore = {
  id: number;
  matchNumber: number;
  trufflePlayerId: number;
  trufflePlayerName: string;
  trufflePhoto: string | null;
  syndicatePlayerId: number;
  syndicatePlayerName: string;
  syndicatePhoto: string | null;
};

type HoleRow = typeof day3Holes.$inferSelect;
type Ctx = Awaited<ReturnType<typeof getMatchCourseContext>>;

/** Resolve one match: compute per-hole net outcomes + match status. */
function resolveOne(
  m: MatchCore,
  holeRows: HoleRow[],
  ctx: Ctx,
  idx: Map<number, number>,
) {
  const holeInputs: MatchHoleInput[] = holeRows.map((h) => ({
    holeNumber: h.holeNumber,
    strokeIndex: ctx.strokeIndex.get(h.holeNumber) ?? null,
    truffleGross: h.trufflePlayerGross,
    syndicateGross: h.syndicatePlayerGross,
  }));

  const mr = computeMatch({
    truffleIndex: idx.get(m.trufflePlayerId) ?? null,
    syndicateIndex: idx.get(m.syndicatePlayerId) ?? null,
    course: ctx.course,
    holes: holeInputs,
  });

  // Overlay stored per-hole winners (2025 legacy / manual) where no grosses exist.
  const storedByHole = new Map(holeRows.map((h) => [h.holeNumber, h.winner]));
  const holes = mr.holes.map((h) => {
    let outcome = h.outcome;
    if (outcome == null) {
      const w = storedByHole.get(h.holeNumber);
      if (w) outcome = OUTCOME_FROM_WINNER[w] ?? null;
    }
    return { ...h, outcome };
  });

  const status = matchStatusFromOutcomes(
    holes.map((h) => ({ holeNumber: h.holeNumber, outcome: h.outcome })),
  );

  return {
    ...m,
    truffleCourseHandicap: mr.truffleCourseHandicap,
    syndicateCourseHandicap: mr.syndicateCourseHandicap,
    strokesDiff: mr.strokesDiff,
    receiver: mr.receiver,
    holes,
    truffleHolesWon: holes.filter((h) => h.outcome === "truffle").length,
    syndicateHolesWon: holes.filter((h) => h.outcome === "syndicate").length,
    tiedHoles: holes.filter((h) => h.outcome === "tie").length,
    holesPlayed: holes.filter((h) => h.outcome != null).length,
    diff: status.diff,
    status: status.status,
    winner: status.winner, // "truffle" | "syndicate" | "halved" | null
    label: status.label,
    decidedAtHole: status.decidedAtHole,
  };
}

type ResolvedMatch = ReturnType<typeof resolveOne>;

async function resolveMatches(seasonId: number): Promise<ResolvedMatch[]> {
  const [ctx, idx, matchRows] = await Promise.all([
    getMatchCourseContext(seasonId),
    getSeasonIndexByPlayer(seasonId),
    db
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
      .where(eq(day3Matches.seasonId, seasonId))
      .orderBy(asc(day3Matches.matchNumber)),
  ]);

  const ids = matchRows.map((m) => m.id);
  const allHoles = ids.length
    ? await db.select().from(day3Holes).where(inArray(day3Holes.matchId, ids))
    : [];
  const byMatch = new Map<number, HoleRow[]>();
  for (const h of allHoles) {
    const arr = byMatch.get(h.matchId) ?? [];
    arr.push(h);
    byMatch.set(h.matchId, arr);
  }

  return matchRows.map((m) => resolveOne(m, byMatch.get(m.id) ?? [], ctx, idx));
}

/** Match list (includes per-hole detail) — for the leaderboard + home summary. */
export async function getDay3Matches(seasonId: number) {
  return resolveMatches(seasonId);
}

/** One match with full per-hole detail — for the scoreboard. */
export async function getDay3Match(id: number) {
  const [row] = await db
    .select({ seasonId: day3Matches.seasonId })
    .from(day3Matches)
    .where(eq(day3Matches.id, id))
    .limit(1);
  if (!row) return null;
  const [resolved, ctx] = await Promise.all([
    resolveMatches(row.seasonId),
    getMatchCourseContext(row.seasonId),
  ]);
  const match = resolved.find((m) => m.id === id);
  if (!match) return null;
  return { ...match, courseHoles: ctx.holeList };
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

/** Enter/overwrite both players' gross on a hole. Net winner is computed on read. */
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
      trufflePlayerGross: data.trufflePlayerGross,
      syndicatePlayerGross: data.syndicatePlayerGross,
      winner: null,
    })
    .onConflictDoUpdate({
      target: [day3Holes.matchId, day3Holes.holeNumber],
      set: {
        trufflePlayerGross: data.trufflePlayerGross,
        syndicatePlayerGross: data.syndicatePlayerGross,
        winner: null,
      },
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
  const matches = await resolveMatches(seasonId);

  let truffleMatchWins = 0;
  let syndicateMatchWins = 0;
  let tiedMatches = 0;
  let truffleTotalHoles = 0;
  let syndicateTotalHoles = 0;

  for (const m of matches) {
    truffleTotalHoles += m.truffleHolesWon;
    syndicateTotalHoles += m.syndicateHolesWon;
    if (m.status !== "final") continue;
    if (m.winner === "truffle") truffleMatchWins += 1;
    else if (m.winner === "syndicate") syndicateMatchWins += 1;
    else if (m.winner === "halved") tiedMatches += 1;
  }

  return {
    summary: {
      truffleMatchWins,
      syndicateMatchWins,
      tiedMatches,
      // Ryder-Cup-style points: a win is 1, a halved match is ½ each.
      trufflePoints: truffleMatchWins + tiedMatches * 0.5,
      syndicatePoints: syndicateMatchWins + tiedMatches * 0.5,
      truffleTotalHoles,
      syndicateTotalHoles,
    },
    matches,
  };
}

/**
 * Pull both players' Sunday (day=3) rounds from TheGrint and fill the match
 * hole-by-hole. Finds each player's round by course + date, reads their per-hole
 * grosses, and writes holes where BOTH players have a score. Returns what was found.
 */
export async function importMatchFromGrint(matchId: number) {
  await requireAdminOrMatchPlayer(matchId);
  const seasonId = await getCurrentSeasonId();

  const [match] = await db
    .select({
      seasonId: day3Matches.seasonId,
      truffleId: day3Matches.trufflePlayerId,
      syndicateId: day3Matches.syndicatePlayerId,
    })
    .from(day3Matches)
    .where(eq(day3Matches.id, matchId))
    .limit(1);
  if (!match || match.seasonId !== seasonId)
    throw new Error("Cannot score a match from a past season");

  const [seg] = await getImportSegments(seasonId, 3);
  if (!seg || seg.grintCourseId == null)
    throw new Error("The Sunday course isn't configured / mapped to TheGrint yet.");

  const pRows = await db
    .select({ id: players.id, grintId: players.grintId })
    .from(players)
    .where(inArray(players.id, [match.truffleId, match.syndicateId]));
  const grintById = new Map(pRows.map((r) => [r.id, r.grintId]));

  async function holesFor(playerId: number): Promise<Map<number, number> | null> {
    const grintId = grintById.get(playerId);
    if (!grintId) return null;
    const rounds = await fetchRounds(grintId);
    const m = await matchSegment(rounds, seg);
    if (m.candidates.length !== 1) return null; // none or ambiguous
    const scores = await fetchHoleScores(m.candidates[0].scoreId, seg.holes as 9 | 18);
    return new Map(scores.filter((s) => s.gross > 0).map((s) => [s.holeNumber, s.gross]));
  }

  const [truffle, syndicate] = await Promise.all([
    holesFor(match.truffleId),
    holesFor(match.syndicateId),
  ]);

  let holesWritten = 0;
  if (truffle && syndicate) {
    for (let h = 1; h <= seg.holes; h++) {
      const tg = truffle.get(h);
      const sg = syndicate.get(h);
      if (tg == null || sg == null) continue;
      await db
        .insert(day3Holes)
        .values({
          matchId,
          holeNumber: h,
          trufflePlayerGross: tg,
          syndicatePlayerGross: sg,
          winner: null,
        })
        .onConflictDoUpdate({
          target: [day3Holes.matchId, day3Holes.holeNumber],
          set: { trufflePlayerGross: tg, syndicatePlayerGross: sg, winner: null },
        });
      holesWritten += 1;
    }
  }

  return {
    truffleFound: truffle != null,
    syndicateFound: syndicate != null,
    holesWritten,
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
