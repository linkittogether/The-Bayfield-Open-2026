import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  day2Teams,
  players,
  seasonRosters,
  seasons,
  segmentScores,
  segments,
} from "../src/db/schema";

/**
 * Seed / wipe test data for the Day-1 → Saturday-pairing draft, on the CURRENT
 * season only. Safe to run repeatedly.
 *
 *   npm run draft:seed   # give the 20 active players Bluewater scores + arm the draft
 *   npm run draft:wipe   # remove those scores + any drafted pairs + reset picking state
 *
 * NOTE: this clears the current season's Day-1 segment scores and day2_teams. Only
 * run it on a season that isn't holding real results (e.g. the upcoming 2026).
 */

async function currentSeason() {
  const [s] = await db.select().from(seasons).where(eq(seasons.isCurrent, true));
  if (!s) throw new Error("No current season (is_current = true)");
  return s;
}

async function day1SegmentIds(seasonId: number) {
  const rows = await db
    .select({ id: segments.id })
    .from(segments)
    .where(and(eq(segments.seasonId, seasonId), eq(segments.day, 1)));
  return rows.map((r) => r.id);
}

async function seed() {
  const s = await currentSeason();
  const segIds = await day1SegmentIds(s.id);
  if (segIds.length === 0) {
    throw new Error(`${s.year} has no Day-1 (Friday) segment configured`);
  }
  const fridaySeg = segIds[0];

  const roster = await db
    .select({ playerId: seasonRosters.playerId, name: players.name })
    .from(seasonRosters)
    .innerJoin(players, eq(players.id, seasonRosters.playerId))
    .where(
      and(eq(seasonRosters.seasonId, s.id), eq(seasonRosters.absent, false)),
    )
    .orderBy(asc(players.name));

  // fresh slate for the draft
  await db.delete(segmentScores).where(inArray(segmentScores.segmentId, segIds));
  await db.delete(day2Teams).where(eq(day2Teams.seasonId, s.id));

  // distinct, scrambled 9-hole gross scores (i*7 mod 20 is a permutation of 0..19)
  const rows = roster.map((p, i) => ({
    segmentId: fridaySeg,
    playerId: p.playerId,
    gross: 38 + ((i * 7) % 20),
  }));
  await db.insert(segmentScores).values(rows);

  await db
    .update(seasons)
    .set({
      nextPickerRank: 10, // 10th place picks first
      day1PickingStarted: false,
      day1PickingComplete: false,
      day1Complete: false,
      day2Complete: false,
      day2DraftComplete: false,
    })
    .where(eq(seasons.id, s.id));

  console.log(
    `✓ seeded ${rows.length} Day-1 scores for ${s.year}; nextPickerRank=10, ` +
      `picking not started. Go to /${s.year}/day1/leaderboard → Start Partner Pick.`,
  );
}

async function wipe() {
  const s = await currentSeason();
  const segIds = await day1SegmentIds(s.id);
  if (segIds.length) {
    await db.delete(segmentScores).where(inArray(segmentScores.segmentId, segIds));
  }
  const delTeams = await db
    .delete(day2Teams)
    .where(eq(day2Teams.seasonId, s.id));
  await db
    .update(seasons)
    .set({
      nextPickerRank: null,
      day1PickingStarted: false,
      day1PickingComplete: false,
      day2DraftComplete: false,
    })
    .where(eq(seasons.id, s.id));

  console.log(
    `✓ wiped Day-1 test data for ${s.year}: Day-1 scores + ${delTeams.count ?? 0} pairs removed; picking state reset.`,
  );
}

const mode = process.argv[2];
const run =
  mode === "wipe"
    ? wipe()
    : mode === "seed"
      ? seed()
      : Promise.reject(new Error("usage: day1-draft-testdata.ts <seed|wipe>"));

run
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
