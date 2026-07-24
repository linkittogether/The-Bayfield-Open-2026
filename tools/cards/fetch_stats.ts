/**
 * Print a player's Bayfield career finishes, to help author their card's
 * rules text. Uses the app's own scoring engine so the numbers match the app.
 *
 *   npx tsx --env-file=.env.local tools/cards/fetch_stats.ts "Joe M"
 *
 * For each season the player was rostered it prints: handicap index, cumulative
 * net, individual net rank, and their pair result (partner, combined net, rank,
 * DQ/incomplete flags). DQ'd / incomplete pairs have no combined net.
 */
import postgres from "postgres";
import { getDay2Leaderboard } from "../../src/lib/server/day2";
import { getSeasonScoring } from "../../src/lib/server/scoring";

async function main() {
  const query = process.argv[2];
  if (!query) throw new Error('usage: fetch_stats.ts "<player name substring>"');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const [p] = await sql`SELECT id, name, full_name FROM players WHERE name ILIKE ${`%${query}%`} OR full_name ILIKE ${`%${query}%`} LIMIT 1`;
  if (!p) throw new Error(`no player matching "${query}"`);
  console.log(`\n${p.full_name ?? p.name} (id ${p.id})`);

  const seasons = await sql`SELECT id, year FROM seasons ORDER BY year`;
  for (const s of seasons) {
    const [r] = await sql`SELECT handicap_index FROM season_rosters WHERE season_id=${s.id} AND player_id=${p.id}`;
    if (!r) { console.log(`  ${s.year}: — not in field`); continue; }

    const scoring = await getSeasonScoring(s.id);
    const me = scoring.byPlayer.get(p.id);
    const ranked = [...scoring.byPlayer.values()]
      .filter((x) => x.cumulativeNet != null)
      .sort((a, b) => a.cumulativeNet! - b.cumulativeNet!);
    const rank = ranked.findIndex((x) => x.playerId === p.id) + 1;

    const d2 = await getDay2Leaderboard(s.id);
    const pair = d2.find((t) => t.player1Id === p.id || t.player2Id === p.id);
    const partner = pair ? (pair.player1Id === p.id ? pair.player2Name : pair.player1Name) : null;
    const pairRank = d2
      .filter((t) => !t.disqualified && !t.incomplete && t.combinedNet != null)
      .findIndex((t) => t.id === pair?.id);

    const parts = [
      `idx ${r.handicap_index}`,
      me?.cumulativeNet != null ? `net ${me.cumulativeNet.toFixed(1)} (indiv #${rank}/${ranked.length})` : "no net",
    ];
    if (pair) {
      const status = pair.disqualified ? "DQ" : pair.incomplete ? "incomplete" : `net ${pair.combinedNet} (pair #${pairRank + 1})`;
      parts.push(`pair w/ ${partner}: ${status}`);
    }
    console.log(`  ${s.year}: ${parts.join(" | ")}`);
  }
  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
