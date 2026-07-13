import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { seasons, segmentScores } from "../src/db/schema";
import {
  getImportSegments,
  getRosterGrintIds,
  matchPlayerSegments,
  writeSegmentScore,
  type SegmentMatch,
} from "../src/lib/server/grint-import";

/**
 * Batch-import stroke-play grosses from TheGrint for a whole season (or one day),
 * driven by the season's segment config (course + holes + date). Re-runnable.
 *
 *   npm run grint:import -- --year 2025 --dry-run     # preview matches, write nothing
 *   npm run grint:import -- --year 2025               # write matched grosses
 *   npm run grint:import -- --year 2026 --day 1       # just Friday
 *
 * Only single, unambiguous matches are written. "none"/"ambiguous"/"no-course-id"
 * are reported and skipped. Dry-run also diffs pulled grosses against any scores
 * already in the DB — handy for verifying a backfill.
 */

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const year = Number(arg("year"));
  if (!year) throw new Error("--year <YYYY> is required");
  const day = arg("day") ? Number(arg("day")) : undefined;
  const dryRun = flag("dry-run");

  const [season] = await db.select().from(seasons).where(eq(seasons.year, year));
  if (!season) throw new Error(`no season for year ${year}`);

  const segs = await getImportSegments(season.id, day);
  if (segs.length === 0) throw new Error(`no segments for ${year}${day ? ` day ${day}` : ""}`);
  const roster = await getRosterGrintIds(season.id);

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Importing ${year}${day ? ` day ${day}` : ""}: ` +
      `${segs.length} segment(s), ${roster.length} rostered players with a Grint link.\n`,
  );
  for (const s of segs) {
    console.log(
      `  segment ${s.id}: d${s.day}#${s.sortOrder} "${s.label}" ${s.holes}h ` +
        `${s.date ?? "(no date)"} course=${s.courseName ?? "?"} grint=${s.grintCourseId ?? "MISSING"}`,
    );
  }
  console.log();

  // Existing scores, for the diff.
  const segIds = segs.map((s) => s.id);
  const existing = new Map<string, number>();
  for (const row of await db
    .select()
    .from(segmentScores)
    .where(inArray(segmentScores.segmentId, segIds))) {
    existing.set(`${row.segmentId}:${row.playerId}`, row.gross);
  }

  const tally = { written: 0, unchanged: 0, none: 0, ambiguous: 0, noCourse: 0, mismatch: 0 };

  for (const p of roster) {
    let matches: SegmentMatch[];
    try {
      matches = await matchPlayerSegments(p.grintId, segs);
    } catch (e) {
      console.log(`  ${p.name.padEnd(12)} FETCH FAILED: ${(e as Error).message}`);
      continue;
    }

    const parts: string[] = [];
    for (const m of matches) {
      const tag = `${m.segment.label}`;
      if (m.segment.grintCourseId === null) {
        tally.noCourse++;
        parts.push(`${tag}: no courseId`);
        continue;
      }
      if (m.status === "none") {
        tally.none++;
        parts.push(`${tag}: —`);
        continue;
      }
      if (m.status === "ambiguous") {
        tally.ambiguous++;
        parts.push(`${tag}: AMBIG(${m.candidates.length})`);
        continue;
      }
      const c = m.candidates[0];
      const gross = c.gross;
      const prev = existing.get(`${m.segment.id}:${p.playerId}`);
      const diff =
        prev === undefined ? "new" : prev === gross ? "=" : `was ${prev}`;
      if (prev !== undefined && prev !== gross) tally.mismatch++;
      parts.push(`${tag}: ${gross} (${diff}, sl${c.slope})`);

      if (gross === null) continue;
      if (!dryRun) {
        await writeSegmentScore(m.segment.id, p.playerId, gross);
        if (prev === gross) tally.unchanged++;
        else tally.written++;
      } else if (prev === gross) {
        tally.unchanged++;
      } else {
        tally.written++;
      }
    }
    console.log(`  ${p.name.padEnd(12)} ${parts.join("  |  ")}`);
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] would " : ""}write ${tally.written}, unchanged ${tally.unchanged}, ` +
      `none ${tally.none}, ambiguous ${tally.ambiguous}, no-course ${tally.noCourse}` +
      (tally.mismatch ? `, ⚠ ${tally.mismatch} DIFFER from existing` : ""),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("GRINT IMPORT FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
