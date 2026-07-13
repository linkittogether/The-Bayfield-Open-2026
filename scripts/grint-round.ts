import {
  fetchRounds,
  fetchScoreDetail,
  findRounds,
  grintIdForPlayer,
  type GrintRound,
} from "../src/lib/server/grint-rounds";

/**
 * Look up a specific round from TheGrint's score feed and print it (score +
 * course + displayed rating/slope), then click through for detail when possible.
 *
 *   npm run grint:round -- --player "Josh" --course bluewater --year 2025
 *   npm run grint:round -- --user 1731852 --course "grey silo" --year 2025 --holes 18
 *   npm run grint:round -- --user 1731852            # list all of a player's rounds
 *
 * Flags:
 *   --user <grintId>     Grint userId directly
 *   --player <substr>    resolve via the players table (name substring → grintId)
 *   --course <substr>    filter by course name (case-insensitive substring)
 *   --year <YYYY>        filter by year
 *   --holes <9|18>       filter by round length
 *   --company <id>       handicap_company_id (default 7)
 *   --detail             fetch the per-round detail page for each match
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function fmt(r: GrintRound): string {
  const rs =
    r.ratingDisplay !== null ? `${r.ratingDisplay}${r.slopeDisplay ? ` | ${r.slopeDisplay}` : ""}` : "—";
  return (
    `  ${r.date}  id=${r.scoreId.padEnd(9)} ${String(r.gross ?? "?").padStart(3)} ` +
    `(${r.holes}h)  ${r.course} — ${r.teeLabel} [${rs}]`
  );
}

async function main() {
  let userId = arg("user");
  const playerQ = arg("player");

  if (!userId && playerQ) {
    const matches = await grintIdForPlayer(playerQ);
    if (matches.length === 0) throw new Error(`no player with grintId matching "${playerQ}"`);
    if (matches.length > 1) {
      console.log(`Multiple players match "${playerQ}":`);
      for (const m of matches) console.log(`  ${m.name} (grintId ${m.grintId})`);
      throw new Error("ambiguous --player; narrow it or use --user");
    }
    userId = String(matches[0].grintId);
    console.log(`Resolved "${playerQ}" → ${matches[0].name} (grintId ${userId})\n`);
  }
  if (!userId) throw new Error("provide --user <grintId> or --player <substr>");

  const company = arg("company") ? Number(arg("company")) : 7;
  console.log(`Fetching rounds for userId ${userId} (company ${company})…`);
  const rounds = await fetchRounds(userId, { companyId: company });
  console.log(`  ${rounds.length} rounds on record.\n`);

  const filter = {
    course: arg("course"),
    year: arg("year") ? Number(arg("year")) : undefined,
    holes: arg("holes") ? (Number(arg("holes")) as 9 | 18) : undefined,
  };
  const hasFilter = filter.course || filter.year || filter.holes;
  const matches = hasFilter ? findRounds(rounds, filter) : rounds;

  if (matches.length === 0) {
    console.log("No rounds match that filter.");
    return;
  }

  console.log(hasFilter ? `Matches (${matches.length}):` : `All rounds (${matches.length}):`);
  for (const r of matches) console.log(fmt(r));

  if (flag("detail")) {
    console.log("\nDetails (authoritative WHS rating/slope via get_course_hdcp):");
    for (const r of matches) {
      const d = await fetchScoreDetail(r.scoreId, { holes: r.holes });
      if (!d.ok) {
        console.log(`  ${r.scoreId}: ${d.note}`);
      } else {
        console.log(
          `  ${r.scoreId}: ${d.courseName} (id ${d.courseId}) ${d.tee} ${d.round}` +
            `  rating=${d.rating} slope=${d.slope} courseHdcp=${d.courseHandicap}` +
            `  index=${d.index} diff=${d.differential}`,
        );
      }
      await new Promise((res) => setTimeout(res, 300));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("GRINT ROUND LOOKUP FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
