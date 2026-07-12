import bcrypt from "bcryptjs";
import { db } from "./index";
import { admins, seasons, teams } from "./schema";

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_CODE = "BAYFIELD2026";

async function main() {
  const codeHash = await bcrypt.hash(DEFAULT_ADMIN_CODE, 12);

  await db
    .insert(admins)
    .values({ username: DEFAULT_ADMIN_USERNAME, codeHash })
    .onConflictDoNothing({ target: admins.username });

  await db
    .insert(teams)
    .values([
      { name: "Truffle Hogs", slug: "truffle_hogs" },
      { name: "The Mycelium Syndicate", slug: "mycelium_syndicate" },
    ])
    .onConflictDoNothing({ target: teams.slug });

  const year = new Date().getFullYear();
  await db
    .insert(seasons)
    .values({ year, isCurrent: true, currentDay: 1 })
    .onConflictDoNothing({ target: seasons.year });

  console.log(`Seed complete: admin + teams + ${year} season`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
