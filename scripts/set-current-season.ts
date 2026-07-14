import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { seasons } from "../src/db/schema";

/**
 * Flip which season is "current" (the one the app treats as live / editable).
 * Only one season can be current at a time.
 *
 *   npm run season:current -- 2024   # activate the dry-run sandbox
 *   npm run season:current -- 2026   # switch back to the real upcoming season
 *   npm run season:current           # show which season is current
 */
async function main() {
  const yearArg = process.argv[2];

  if (!yearArg) {
    const cur = await db.select().from(seasons).where(eq(seasons.isCurrent, true));
    console.log("Current season:", cur[0]?.year ?? "(none)");
    return;
  }

  const year = Number(yearArg);
  const [target] = await db.select().from(seasons).where(eq(seasons.year, year));
  if (!target) throw new Error(`No season for year ${year}`);

  await db.transaction(async (tx) => {
    // Clear the existing current first (unique index allows only one).
    await tx.update(seasons).set({ isCurrent: false }).where(eq(seasons.isCurrent, true));
    await tx.update(seasons).set({ isCurrent: true }).where(eq(seasons.id, target.id));
  });

  console.log(`✓ Season ${year} is now current.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
