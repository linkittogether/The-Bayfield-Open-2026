import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { courses, seasonRosters, seasons, segments } from "../src/db/schema";

/**
 * One-off: build a 2024 "dry-run sandbox" season by cloning the real 2025
 * tournament (same courses + real July-2025 dates so Grint pulls find real
 * rounds), then ADD a Day-3 Ironwood segment (2025 has none). Scores are left
 * empty and all state flags are fresh, so the whole flow can be rehearsed.
 *
 *   npx tsx --env-file=.env.local scripts/clone-2024-sandbox.ts
 */
async function main() {
  const [existing] = await db.select().from(seasons).where(eq(seasons.year, 2024));
  if (existing) throw new Error("Season 2024 already exists — aborting to avoid clobbering.");

  const [src] = await db.select().from(seasons).where(eq(seasons.year, 2025));
  if (!src) throw new Error("Source season 2025 not found.");

  // Ironwood Blue 18 data (rating/slope/par + courseHoles) already exists via
  // the 2026 season — reuse it for the Day-3 segment.
  const ironSeg = (
    await db
      .select({ seg: segments, name: courses.name })
      .from(segments)
      .leftJoin(courses, eq(segments.courseId, courses.id))
  ).find((r) => (r.name ?? "").toLowerCase().includes("ironwood") && r.seg.holes === 18);
  if (!ironSeg) throw new Error("No existing Ironwood 18h segment to source Day-3 data from.");

  const [tgt] = await db
    .insert(seasons)
    .values({
      year: 2024,
      isCurrent: false,
      currentDay: 1,
      day1Complete: false,
      day1PickingStarted: false,
      day1PickingComplete: false,
      day2Complete: false,
      day2DraftComplete: false,
      day3Complete: false,
      nextPickerRank: 10,
    })
    .returning();
  console.log(`Created season 2024 (id ${tgt.id}).`);

  // 1) Clone 2025 segments (Day 1 Bluewater + Day 2 Sunset back9/18).
  const srcSegs = await db.select().from(segments).where(eq(segments.seasonId, src.id));
  for (const s of srcSegs) {
    await db.insert(segments).values({
      seasonId: tgt.id,
      courseId: s.courseId,
      day: s.day,
      sortOrder: s.sortOrder,
      label: s.label,
      holes: s.holes,
      tee: s.tee,
      grintRound: s.grintRound,
      rating: s.rating,
      slope: s.slope,
      par: s.par,
      date: s.date,
    });
    console.log(`  + segment d${s.day} ${s.label} (${s.holes}h, ${s.date})`);
  }

  // 2) Add Day-3 Ironwood segment (Sun 2025-07-27, Blue tee).
  const i = ironSeg.seg;
  await db.insert(segments).values({
    seasonId: tgt.id,
    courseId: i.courseId,
    day: 3,
    sortOrder: 1,
    label: "Ironwood",
    holes: 18,
    tee: i.tee,
    grintRound: "18",
    rating: i.rating,
    slope: i.slope,
    par: i.par,
    date: "2025-07-27",
  });
  console.log(`  + segment d3 Ironwood (18h, 2025-07-27, ${i.tee})`);

  // 3) Copy the 2025 roster.
  const srcRoster = await db.select().from(seasonRosters).where(eq(seasonRosters.seasonId, src.id));
  for (const r of srcRoster) {
    await db.insert(seasonRosters).values({
      seasonId: tgt.id,
      playerId: r.playerId,
      teamId: r.teamId,
      absent: r.absent,
      isCaptain: r.isCaptain,
      handicapIndex: r.handicapIndex,
    });
  }
  console.log(`  + copied ${srcRoster.length} roster entries.`);

  console.log("\n✓ 2024 sandbox ready (not current yet — scores empty).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
