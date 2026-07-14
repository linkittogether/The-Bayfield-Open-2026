import { isNotNull } from "drizzle-orm";
import { db } from "../src/db";
import { players } from "../src/db/schema";

/**
 * List players that have a Google email assigned (login allowlist check).
 *
 *   npm run check:emails
 */
async function main() {
  const rows = await db
    .select({ id: players.id, name: players.name, email: players.email })
    .from(players)
    .where(isNotNull(players.email))
    .orderBy(players.name);

  if (!rows.length) {
    console.log("No players have an email assigned yet.");
    return;
  }
  console.log(`${rows.length} player(s) with email:`);
  for (const r of rows) {
    console.log(`  #${r.id}  ${r.name.padEnd(16)} ${r.email}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
