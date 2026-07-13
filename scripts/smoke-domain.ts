import { getDay1Leaderboard, getDay1PicksOverview } from "../src/lib/server/day1";
import { getDay2Leaderboard } from "../src/lib/server/day2";
import { getDay3Leaderboard } from "../src/lib/server/day3";
import { getCurrentSeasonId } from "../src/lib/server/seasons";
import { getSeasonState } from "../src/lib/server/tournament";

/**
 * Read-only smoke test: the season's leaderboard/state queries run and return
 * sane shapes. (Scores now come from segment_scores with computed WHS nets, so
 * this no longer inserts test day1_scores.)
 */
async function main() {
  const seasonId = await getCurrentSeasonId();

  const lb = await getDay1Leaderboard(seasonId);
  if (!Array.isArray(lb)) throw new Error("day1 leaderboard should return an array");
  for (let i = 1; i < lb.length; i++) {
    if (lb[i].netScore < lb[i - 1].netScore)
      throw new Error("day1 leaderboard not sorted ascending by net");
  }
  console.log(`✓ day1 leaderboard runs + sorted (${lb.length} scored)`);

  const picks = await getDay1PicksOverview(seasonId);
  if (!picks.state || picks.state.id !== seasonId)
    throw new Error("picks overview missing season state");
  console.log("✓ day1 picks overview runs");

  const day2lb = await getDay2Leaderboard(seasonId);
  if (!Array.isArray(day2lb)) throw new Error("day2 leaderboard should return an array");
  console.log(`✓ day2 leaderboard runs (${day2lb.length} pairs)`);

  const day3lb = await getDay3Leaderboard(seasonId);
  if (typeof day3lb.summary.truffleMatchWins !== "number")
    throw new Error("day3 summary shape wrong");
  console.log(`✓ day3 leaderboard runs (${day3lb.matches.length} matches)`);

  const state = await getSeasonState(seasonId);
  if (!state || state.id !== seasonId) throw new Error("season state missing");
  console.log(`✓ season state present (currentDay=${state.currentDay})`);

  console.log("\nALL SMOKE TESTS PASSED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SMOKE TEST FAILED:", err);
    process.exit(1);
  });
