import { listCourseTees, resolveCourse } from "../src/lib/server/grint-rounds";

/**
 * Look up a course on TheGrint and list its tees + rating/slope, so you can pick
 * the exact tee string for scripts/setup-season.ts. Tee names must match Grint
 * exactly (e.g. Woodlands has Bronze/Silver/Gold — no "White"/"Blue").
 *
 *   npm run grint:tees -- --course "Woodlands"
 *   npm run grint:tees -- --id 18216
 */
function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const idArg = arg("id");
  const query = arg("course");

  let courseId = idArg;
  if (!courseId) {
    if (!query) throw new Error("provide --course <name> or --id <grintCourseId>");
    const matches = await resolveCourse(query);
    if (matches.length === 0) throw new Error(`no course matching "${query}"`);
    console.log(`Matches for "${query}":`);
    for (const m of matches) console.log(`  ${m.id}: ${m.name}`);
    courseId = matches[0].id;
    console.log(`\nTees for ${matches[0].name} (id ${courseId}):`);
  } else {
    console.log(`Tees for course id ${courseId}:`);
  }

  const tees = await listCourseTees(courseId);
  if (tees.length === 0) {
    console.log("  (no men's tees found)");
    return;
  }
  for (const t of tees) {
    console.log(`  ${t.tee.padEnd(14)} rating ${t.rating}  slope ${t.slope}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("GRINT TEES LOOKUP FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
