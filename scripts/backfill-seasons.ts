import { eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import {
  day2Teams,
  day3Matches,
  players,
  seasonRosters,
  seasons,
  teams,
} from "../src/db/schema";

/**
 * One-shot backfill for the multi-year refactor. Creates the 2026 season from
 * the existing tournament_state singleton, seeds the two teams, stamps season_id
 * onto all existing result rows, and builds season_rosters from the authoritative
 * 2026 roster below.
 *
 * MUST run AFTER migration 0003 (adds nullable season_id + the new tables) and
 * BEFORE migration 0004 (sets season_id NOT NULL + drops tournament_state/day3_players).
 *
 *   npm run backfill:seasons
 */

const YEAR = 2026;

// Authoritative 2026 rosters (by players.name). Mike Harris is on Truffle Hogs
// but absent this year; Steve M replaces him in the active lineup.
const TRUFFLE = [
  "Adison E", "Mike P", "Duncan M", "Joe M", "Rob V",
  "Spencer C", "Chris G", "Daniel C", "Owen T", "Steve M", "Mike H",
];
const MYCELIUM = [
  "Dave G", "Grant M", "James P", "Jordan C", "Jordan H",
  "Josh W", "Korey B", "Ryan P", "Scott M", "Travis W",
];
const ABSENT = new Set(["Mike H"]);
const CAPTAINS = new Set(["Adison E", "Josh W"]);

async function main() {
  await db.transaction(async (tx) => {
    // 1. Guard — one-shot.
    const existing = await tx
      .select({ id: seasons.id })
      .from(seasons)
      .where(eq(seasons.year, YEAR));
    if (existing.length) {
      throw new Error(`${YEAR} season already exists — backfill is one-shot`);
    }

    // 2. Create the 2026 season. This originally copied the live state from the
    // tournament_state singleton (currentDay + completion flags); that table has
    // since been dropped (migration 0004), so this guarded one-shot now just
    // seeds default state — its real remaining value is the roster backfill below.
    const [season] = await tx
      .insert(seasons)
      .values({
        year: YEAR,
        isCurrent: true,
        currentDay: 1,
      })
      .returning();
    console.log(`created season ${YEAR} (id=${season.id}), currentDay=${season.currentDay}`);

    // 3. Teams (slug MUST match old enum values for CSS/emoji keying).
    await tx
      .insert(teams)
      .values([
        { name: "Truffle Hogs", slug: "truffle_hogs" },
        { name: "The Mycelium Syndicate", slug: "mycelium_syndicate" },
      ])
      .onConflictDoNothing({ target: teams.slug });
    const teamRows = await tx.select().from(teams);
    const teamIdBySlug = new Map(teamRows.map((t) => [t.slug, t.id]));

    // 4. Stamp season_id onto all existing result rows (all are 2026).
    await tx.update(day2Teams).set({ seasonId: season.id });
    await tx.update(day3Matches).set({ seasonId: season.id });

    // 5. Seed season_rosters from the authoritative 2026 roster.
    const playerRows = await tx
      .select({ id: players.id, name: players.name })
      .from(players);
    const idByName = new Map(playerRows.map((p) => [p.name, p.id]));

    const rosterRows: (typeof seasonRosters.$inferInsert)[] = [];
    const groups: { slug: string; names: string[] }[] = [
      { slug: "truffle_hogs", names: TRUFFLE },
      { slug: "mycelium_syndicate", names: MYCELIUM },
    ];
    for (const g of groups) {
      const teamId = teamIdBySlug.get(g.slug);
      if (!teamId) throw new Error(`missing team for slug "${g.slug}"`);
      for (const name of g.names) {
        const playerId = idByName.get(name);
        if (!playerId) throw new Error(`roster: no player named "${name}"`);
        rosterRows.push({
          seasonId: season.id,
          playerId,
          teamId,
          absent: ABSENT.has(name),
          isCaptain: CAPTAINS.has(name),
        });
      }
    }
    await tx
      .insert(seasonRosters)
      .values(rosterRows)
      .onConflictDoNothing({
        target: [seasonRosters.seasonId, seasonRosters.playerId],
      });

    // 6. Assertions + coverage report.
    for (const [label, table] of [
      ["day2_teams", day2Teams],
      ["day3_matches", day3Matches],
    ] as const) {
      const nulls = await tx
        .select({ id: table.id })
        .from(table)
        .where(isNull(table.seasonId));
      if (nulls.length) {
        throw new Error(`${label} still has ${nulls.length} NULL season_id rows`);
      }
    }

    const rosteredIds = new Set(rosterRows.map((r) => r.playerId));
    const unrostered = playerRows.filter((p) => !rosteredIds.has(p.id));
    if (unrostered.length) {
      console.warn(
        `⚠ players with no ${YEAR} roster entry:`,
        unrostered.map((p) => p.name).join(", "),
      );
    }

    console.log(
      `✓ backfill complete: ${rosterRows.length} roster rows ` +
        `(${TRUFFLE.length} Truffle Hogs incl. ${ABSENT.size} absent, ${MYCELIUM.length} Mycelium), ` +
        `0 NULL season_id.`,
    );
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("BACKFILL FAILED:", err);
    process.exit(1);
  });
