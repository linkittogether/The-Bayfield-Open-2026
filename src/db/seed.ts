import bcrypt from "bcryptjs";
import { db } from "./index";
import { admins, tournamentState } from "./schema";

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_CODE = "BAYFIELD2026";

async function main() {
  const codeHash = await bcrypt.hash(DEFAULT_ADMIN_CODE, 12);

  await db
    .insert(admins)
    .values({ username: DEFAULT_ADMIN_USERNAME, codeHash })
    .onConflictDoNothing({ target: admins.username });

  await db
    .insert(tournamentState)
    .values({ id: 1, currentDay: 1 })
    .onConflictDoNothing({ target: tournamentState.id });

  console.log("Seed complete: admin + tournament_state row 1");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
