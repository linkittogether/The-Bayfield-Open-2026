import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { day1Scores, players } from "../src/db/schema";
import { getDay1Leaderboard, getDay1PicksOverview } from "../src/lib/server/day1";
import { getDay2Leaderboard } from "../src/lib/server/day2";
import { getDay3Leaderboard } from "../src/lib/server/day3";
import { getTournamentState } from "../src/lib/server/tournament";

async function main() {
  const pinHash = await bcrypt.hash("0000", 12);
  const inserted = await db
    .insert(players)
    .values([
      { name: "_smoke_A", handicap: 10, pinHash },
      { name: "_smoke_B", handicap: 4, pinHash },
    ])
    .returning({ id: players.id, name: players.name });
  const [a, b] = inserted;
  const cleanupIds = [a.id, b.id];

  try {
    // net = gross - floor(handicap/2)
    // A: 95 - floor(10/2) = 90, B: 80 - floor(4/2) = 78
    await db.insert(day1Scores).values([
      { playerId: a.id, grossScore: 95, netScore: 90 },
      { playerId: b.id, grossScore: 80, netScore: 78 },
    ]);

    const lb = await getDay1Leaderboard();
    const ours = lb.filter((r) => cleanupIds.includes(r.id));
    if (ours.length !== 2) throw new Error(`expected 2 rows, got ${ours.length}`);
    const bRow = ours.find((r) => r.id === b.id)!;
    const aRow = ours.find((r) => r.id === a.id)!;
    if (bRow.netScore !== 78) throw new Error(`B net wrong: ${bRow.netScore}`);
    if (aRow.netScore !== 90) throw new Error(`A net wrong: ${aRow.netScore}`);
    if (bRow.rank >= aRow.rank)
      throw new Error(`B should outrank A (lower net), got B=${bRow.rank} A=${aRow.rank}`);
    console.log("✓ day1 leaderboard ranks + net calc correct");

    const picks = await getDay1PicksOverview();
    if (!picks.state || picks.state.id !== 1)
      throw new Error("picks overview missing tournament state");
    console.log("✓ day1 picks overview query runs");

    const day2lb = await getDay2Leaderboard();
    if (!Array.isArray(day2lb))
      throw new Error("day2 leaderboard should return array");
    console.log(`✓ day2 leaderboard query runs (${day2lb.length} teams)`);

    const day3lb = await getDay3Leaderboard();
    if (typeof day3lb.summary.truffleMatchWins !== "number")
      throw new Error("day3 summary shape wrong");
    console.log(
      `✓ day3 leaderboard query runs (${day3lb.matches.length} matches)`,
    );

    const state = await getTournamentState();
    if (!state || state.id !== 1) throw new Error("tournament state missing");
    console.log(`✓ tournament state row present (currentDay=${state.currentDay})`);

    console.log("\nALL SMOKE TESTS PASSED");
  } finally {
    await db.delete(players).where(inArray(players.id, cleanupIds));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SMOKE TEST FAILED:", err);
    process.exit(1);
  });
