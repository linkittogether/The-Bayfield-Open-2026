import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { courseHoles, courses, seasons, segments } from "../src/db/schema";
import { fetchCourseData } from "../src/lib/server/grint-rounds";

/**
 * Declaratively configure a tournament year's courses + daily segments — the
 * thing that drives what we pull from TheGrint. Idempotent: edit the CONFIG
 * below and re-run to create/update. Never deletes segments or touches scores.
 *
 *   npm run season:setup                 # apply every year in CONFIG
 *   npm run season:setup -- --year 2026  # just that year
 *
 * Each course maps to its TheGrint courseId (find it with `npm run grint:tees --
 * --course "<name>"`, which also lists the tees). Each segment names the `tee`
 * played — rating/slope/par are auto-pulled from Grint for that exact tee when
 * omitted, and (for 18-hole segments) the per-hole stroke index is stored in
 * course_holes for match-play stroke allocation. `date` is the calendar day
 * (YYYY-MM-DD), used to match a player's Grint round on import.
 */

interface CourseConfig {
  name: string;
  grintCourseId: number;
}

interface SegmentConfig {
  day: number; // 1 = Fri (stroke), 2 = Sat (stroke), 3 = Sun (match play)
  sortOrder: number;
  label: string;
  courseName: string; // must match a course in `courses` below
  holes: 9 | 18;
  tee?: string; // exact Grint tee name (see `npm run grint:tees`)
  nine?: "F9" | "B9"; // which nine, for a 9-hole segment (drives the rating scope)
  date?: string; // YYYY-MM-DD
  rating?: number; // omit to auto-pull from Grint for `tee`
  slope?: number;
  par?: number;
}

interface SeasonConfig {
  year: number;
  courses: CourseConfig[];
  segments: SegmentConfig[];
}

// ── Authoritative per-year configuration ────────────────────────────────────
// 2025 keeps its validated stored rating/slope/par (they reproduce the sheet);
// tee is recorded for provenance. New years can omit rating/slope/par to auto-pull.
const CONFIG: SeasonConfig[] = [
  {
    year: 2025,
    courses: [
      { name: "Bluewater", grintCourseId: 37442 },
      { name: "Sunset", grintCourseId: 21191 }, // Goderich Sunset Golf Club
    ],
    segments: [
      { day: 1, sortOrder: 1, label: "Bluewater", courseName: "Bluewater", holes: 9, tee: "White/Blue", nine: "F9", date: "2025-07-25", rating: 34.9, slope: 121, par: 36 },
      { day: 2, sortOrder: 2, label: "Sunset back 9", courseName: "Sunset", holes: 9, tee: "Blue", nine: "B9", date: "2025-07-26", rating: 34.4, slope: 111, par: 36 },
      { day: 2, sortOrder: 3, label: "Sunset 18", courseName: "Sunset", holes: 18, tee: "Blue", date: "2025-07-26", rating: 71.7, slope: 115, par: 72 },
    ],
  },
  // ── 2026 (fill in the DATES + confirm the TEES, then uncomment) ────────────
  // Course ids are confirmed. Tee options (from `npm run grint:tees`):
  //   Bluewater  → White/Blue (69.8/121)
  //   Ironwood   → White (67.7/122) or Blue (69.7/129)   ← pick one
  //   Woodlands  → Bronze (66.5/110), Silver (69.8/119), Gold (72.2/128)  ← pick one
  // rating/slope/par are auto-pulled for the chosen tee. Tees are UI-editable
  // afterward (default here from what the group has historically played).
  {
    year: 2026,
    courses: [
      { name: "Bluewater", grintCourseId: 37442 },
      { name: "Ironwood", grintCourseId: 19407 },
      { name: "Woodlands Links", grintCourseId: 18216 },
    ],
    segments: [
      { day: 1, sortOrder: 1, label: "Bluewater", courseName: "Bluewater", holes: 9, tee: "White/Blue", nine: "F9", date: "2026-07-24" },
      // Day 2 plays the 18 first, then the front 9 (per Ironwood).
      { day: 2, sortOrder: 2, label: "Ironwood 18", courseName: "Ironwood", holes: 18, tee: "Blue", date: "2026-07-25" },
      { day: 2, sortOrder: 3, label: "Ironwood front 9", courseName: "Ironwood", holes: 9, tee: "Blue", nine: "F9", date: "2026-07-25" },
      { day: 3, sortOrder: 1, label: "Woodlands Links", courseName: "Woodlands Links", holes: 18, tee: "Silver", date: "2026-07-26" },
    ],
  },
];

async function applySeason(cfg: SeasonConfig) {
  let [season] = await db.select().from(seasons).where(eq(seasons.year, cfg.year));
  if (!season) {
    [season] = await db.insert(seasons).values({ year: cfg.year }).returning();
    console.log(`  + created season ${cfg.year} (id ${season.id})`);
  }

  const courseIdByName = new Map<string, number>();
  const grintByName = new Map<string, number>();
  for (const c of cfg.courses) {
    const [row] = await db
      .insert(courses)
      .values({ name: c.name, grintCourseId: c.grintCourseId })
      .onConflictDoUpdate({ target: courses.name, set: { grintCourseId: c.grintCourseId } })
      .returning();
    courseIdByName.set(c.name, row.id);
    grintByName.set(c.name, c.grintCourseId);
    console.log(`  course "${c.name}" → grintCourseId ${c.grintCourseId} (id ${row.id})`);
  }

  for (const s of cfg.segments) {
    const courseId = courseIdByName.get(s.courseName);
    const grintCourseId = grintByName.get(s.courseName);
    if (!courseId || !grintCourseId) throw new Error(`segment "${s.label}" references unknown course "${s.courseName}"`);

    let rating = s.rating ?? null;
    let slope = s.slope ?? null;
    let par = s.par ?? null;
    const round = s.holes === 18 ? "18" : (s.nine ?? "F9");

    // Auto-pull rating/slope/par when omitted, and (for 18-hole segments)
    // populate course_holes for match-play stroke allocation.
    const needPull = s.tee && (rating === null || slope === null || par === null || s.holes === 18);
    if (needPull) {
      const cd = await fetchCourseData(grintCourseId, s.tee!, round);
      rating ??= cd.rating;
      slope ??= cd.slope;
      par ??= cd.par;
      if (s.holes === 18) {
        for (const h of cd.holes) {
          await db
            .insert(courseHoles)
            .values({ courseId, tee: s.tee!, holeNumber: h.holeNumber, par: h.par, strokeIndex: h.strokeIndex })
            .onConflictDoUpdate({
              target: [courseHoles.courseId, courseHoles.tee, courseHoles.holeNumber],
              set: { par: h.par, strokeIndex: h.strokeIndex },
            });
        }
        console.log(`    ↳ pulled course data for "${s.courseName}" ${s.tee} → ${rating}/${slope}/${par}, ${cd.holes.length} holes indexed`);
      } else {
        console.log(`    ↳ pulled course data for "${s.courseName}" ${s.tee} ${round} → ${rating}/${slope}/${par}`);
      }
    }

    const values = {
      seasonId: season.id,
      courseId,
      day: s.day,
      sortOrder: s.sortOrder,
      label: s.label,
      holes: s.holes,
      tee: s.tee ?? null,
      grintRound: round,
      rating,
      slope,
      par,
      date: s.date ?? null,
    };
    const [existing] = await db
      .select({ id: segments.id })
      .from(segments)
      .where(and(eq(segments.seasonId, season.id), eq(segments.day, s.day), eq(segments.sortOrder, s.sortOrder)));
    if (existing) {
      await db.update(segments).set(values).where(eq(segments.id, existing.id));
      console.log(`  ~ segment d${s.day}#${s.sortOrder} "${s.label}" ${s.holes}h ${s.tee ?? "(no tee)"} ${s.date ?? ""} → updated (id ${existing.id})`);
    } else {
      const [row] = await db.insert(segments).values(values).returning({ id: segments.id });
      console.log(`  + segment d${s.day}#${s.sortOrder} "${s.label}" ${s.holes}h ${s.tee ?? "(no tee)"} ${s.date ?? ""} → created (id ${row.id})`);
    }
  }
}

async function main() {
  const only = process.argv.includes("--year")
    ? Number(process.argv[process.argv.indexOf("--year") + 1])
    : null;
  const toApply = only ? CONFIG.filter((c) => c.year === only) : CONFIG;
  if (toApply.length === 0) throw new Error(`no CONFIG entry for year ${only}`);
  for (const cfg of toApply) {
    console.log(`\nSeason ${cfg.year}:`);
    await applySeason(cfg);
  }
  console.log("\n✓ season setup complete");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SEASON SETUP FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
