import { db } from "./index";
import { seasons, teams } from "./schema";

// Admins are players with players.isAdmin = true (assign an email + toggle admin
// in the admin panel, or set it directly). Login is Google SSO, so there's no
// seedable default admin — a real Google email must back it.

async function main() {
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

  console.log(`Seed complete: teams + ${year} season`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
