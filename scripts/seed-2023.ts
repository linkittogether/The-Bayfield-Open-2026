import postgres from "postgres";

// 2023 Bayfield Open — individual (Bluewater 9 + White Squirrel 3x9) + Saturday
// pairs. No teams, no match play. 2023 used index-based course handicaps with no
// slope adjustment (course handicap = index, strokes = index x holes/18), so
// segments use slope 113 with rating = par to make the WHS engine compute
// course handicap = index. (The old sheet rounded strokes per round; the app
// keeps full precision, so a few odd-index nets differ by a fraction/stroke.)
//
// [dbShortName, index, fridayGross, [sat1, sat2|null, sat3]]
// Joe did not finish Saturday's middle nine (null) — his pair is DQ'd below.
const ROWS: [string, number, number, [number, number | null, number]][] = [
  ["Spencer C", 6, 40, [43, 40, 42]],
  ["Chris G", 15, 44, [41, 43, 44]],
  ["Jordan H", 0, 39, [39, 38, 39]],
  ["Duncan M", 17, 45, [43, 50, 43]],
  ["Grant M", 17, 43, [45, 42, 41]],
  ["James P", 30, 56, [59, 59, 52]],
  ["Jordan C", 21, 48, [53, 48, 46]],
  ["Josh W", 22, 47, [52, 46, 47]],
  ["Korey B", 25, 51, [49, 50, 55]],
  ["Kyle", 25, 60, [55, 45, 48]],
  ["Owen T", 16, 54, [50, 45, 50]],
  ["Ryan P", 17, 47, [41, 45, 47]],
  ["Adison E", 1, 38, [36, 39, 38]],
  ["Avery", 24, 54, [46, 44, 42]],
  ["Mike P", 18, 47, [44, 40, 45]],
  ["Joe M", 15, 43, [54, null, 46]],
  ["Travis W", 12, 42, [40, 41, 40]],
  ["Dave G", 14, 46, [44, 45, 40]],
  ["Daniel C", 30, 52, [47, 59, 53]],
  ["Scott M", 14, 46, [44, 40, 46]],
];
// Saturday partner pairs (by DB short name), in draft order. `dq`/`dqReason`
// mark a disqualified pair (excluded from standings / champion).
const PAIRS: { a: string; b: string; dq?: string }[] = [
  { a: "Kyle", b: "Spencer C" },
  { a: "Owen T", b: "Grant M" },
  { a: "Avery", b: "Joe M", dq: "Joe did not finish Saturday" },
  { a: "James P", b: "Jordan C" },
  { a: "Dave G", b: "Josh W" },
  { a: "Jordan H", b: "Chris G" },
  { a: "Korey B", b: "Adison E" },
  { a: "Ryan P", b: "Mike P" },
  { a: "Scott M", b: "Travis W" },
  { a: "Daniel C", b: "Duncan M" },
];
const HISTORICAL = ["Kyle"]; // create as historical-only players (new in 2023)

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // players → id (create historical placeholders if missing)
  const idByName = new Map<string, number>();
  for (const [name, idx] of ROWS) {
    let [p] = await sql`SELECT id FROM players WHERE name=${name}`;
    if (!p) {
      if (!HISTORICAL.includes(name)) throw new Error(`Unknown player "${name}" (not historical)`);
      [p] = await sql`INSERT INTO players (name, handicap) VALUES (${name}, ${idx}) RETURNING id`;
      console.log(`  + created historical player "${name}" (id ${p.id})`);
    }
    idByName.set(name, p.id);
  }

  // season 2023 (visible past, not current, no match play)
  let [s] = await sql`SELECT id FROM seasons WHERE year=2023`;
  if (!s) [s] = await sql`INSERT INTO seasons (year) VALUES (2023) RETURNING id`;
  const seasonId = s.id;
  await sql`UPDATE seasons SET
      is_current=false, hidden=false, match_play=false, current_day=2,
      day1_complete=true, day1_picking_started=true, day1_picking_complete=true,
      day2_complete=true, day2_draft_complete=false, day3_complete=false, next_picker_rank=null
    WHERE id=${seasonId}`;

  // courses
  const [bw] = await sql`SELECT id FROM courses WHERE name='Bluewater'`;
  let [ws] = await sql`SELECT id FROM courses WHERE name='White Squirrel'`;
  if (!ws) [ws] = await sql`INSERT INTO courses (name) VALUES ('White Squirrel') RETURNING id`;

  // fresh slate for this season's segments/scores/rosters/pairs
  const segIds = (await sql`SELECT id FROM segments WHERE season_id=${seasonId}`).map((r) => r.id);
  if (segIds.length) await sql`DELETE FROM segment_scores WHERE segment_id IN ${sql(segIds)}`;
  await sql`DELETE FROM segments WHERE season_id=${seasonId}`;
  await sql`DELETE FROM day2_teams WHERE season_id=${seasonId}`;
  await sql`DELETE FROM season_rosters WHERE season_id=${seasonId}`;

  // segments: Bluewater 9 (Fri) + White Squirrel 3x9 (Sat). slope 113 + rating =
  // par → course handicap = index (2023's no-slope, index-based handicaps).
  const seg = async (courseId: number, day: number, sortOrder: number, label: string) => {
    const [r] = await sql`INSERT INTO segments
      (season_id, course_id, day, sort_order, label, holes, tee, grint_round, rating, slope, par, date)
      VALUES (${seasonId}, ${courseId}, ${day}, ${sortOrder}, ${label}, 9, null, ${day === 1 ? "F9" : "B9"}, 36.0, 113, 36, null)
      RETURNING id`;
    return r.id as number;
  };
  const friSeg = await seg(bw.id, 1, 1, "Bluewater");
  const satSegs = [
    await seg(ws.id, 2, 2, "White Squirrel — 1st"),
    await seg(ws.id, 2, 3, "White Squirrel — 2nd"),
    await seg(ws.id, 2, 4, "White Squirrel — 3rd"),
  ];

  // rosters (no team) + per-season index, and segment scores
  for (const [name, idx, fri, sat] of ROWS) {
    const pid = idByName.get(name)!;
    await sql`INSERT INTO season_rosters (season_id, player_id, team_id, handicap_index)
      VALUES (${seasonId}, ${pid}, null, ${idx})`;
    await sql`INSERT INTO segment_scores (segment_id, player_id, gross) VALUES (${friSeg}, ${pid}, ${fri})`;
    for (let i = 0; i < 3; i++) {
      const g = sat[i];
      if (g == null) continue; // unplayed nine (Joe's Saturday DNF)
      await sql`INSERT INTO segment_scores (segment_id, player_id, gross) VALUES (${satSegs[i]}, ${pid}, ${g})`;
    }
  }

  // Saturday pairs
  let order = 1;
  for (const { a, b, dq } of PAIRS) {
    await sql`INSERT INTO day2_teams (season_id, player1_id, player2_id, pick_order, name, disqualified, dq_reason)
      VALUES (${seasonId}, ${idByName.get(a)!}, ${idByName.get(b)!}, ${order}, ${`${a} & ${b}`}, ${!!dq}, ${dq ?? null})`;
    order++;
  }

  console.log(`✓ 2023 seeded: season ${seasonId}, ${ROWS.length} players, 4 segments, ${PAIRS.length} pairs (1 DQ)`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
