import { refreshHandicaps } from "../src/lib/server/grint";

/**
 * Refresh all players' handicaps from TheGrint. Re-runnable.
 *
 *   npm run grint:handicaps
 */
async function main() {
  console.log("Refreshing handicaps from TheGrint...\n");
  const { updated, skipped } = await refreshHandicaps();

  console.log(`✓ updated ${updated.length}:`);
  for (const u of updated) {
    console.log(
      `   ${u.name.padEnd(12)} grint=${String(u.grintId).padEnd(8)} hcp=${String(u.handicap).padEnd(5)} (${u.source})`,
    );
  }

  if (skipped.length) {
    console.log(`\n– skipped ${skipped.length}:`);
    for (const s of skipped) {
      console.log(`   ${s.name.padEnd(12)} grint=${String(s.grintId).padEnd(8)} ${s.reason}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("HANDICAP REFRESH FAILED:", err);
    process.exit(1);
  });
