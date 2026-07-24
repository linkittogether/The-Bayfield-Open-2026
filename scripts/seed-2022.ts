import postgres from "postgres";

// 2022 Bayfield Open — individual (Bluewater 9 + White Squirrel 3x9) + Saturday
// pairs. No teams, no match play. Handicaps are slope-based (Bluewater slope 119,
// White Squirrel slope 118), so segments use those slopes with rating = par to
// reproduce the sheet's nets via the WHS engine.
//
// [shortName, handicap, fridayGross, [sat1, sat2, sat3]]
const ROWS: [string, number, number, [number, number, number]][] = [
  ["Spencer C", 8, 41, [39, 37, 37]],
  ["Korey B", 23, 55, [48, 46, 51]],
  ["Chris G", 12, 42, [40, 50, 41]],
  ["Avery", 25, 48, [48, 49, 49]],
  ["Adison E", 4, 40, [39, 42, 37]],
  ["Jim", 26, 57, [50, 59, 55]],
  ["Grant M", 17, 46, [43, 48, 38]],
  ["Joe M", 15, 48, [42, 43, 41]],
  ["Jordan H", 3, 41, [36, 37, 40]],
  ["Mike P", 18, 48, [51, 43, 43]],
  ["Ryan P", 17, 46, [44, 51, 44]],
  ["Mike H", 9, 44, [45, 44, 41]],
  ["Owen T", 16, 45, [42, 48, 46]],
  ["Duncan M", 22, 46, [48, 58, 47]],
  ["Josh W", 20, 48, [47, 45, 50]],
  ["Jordan C", 18, 45, [52, 44, 49]],
];
// Saturday partner pairs (by short name).
const PAIRS: [string, string][] = [
  ["Grant M", "Joe M"],
  ["Spencer C", "Korey B"],
  ["Chris G", "Avery"],
  ["Jordan H", "Mike P"],
  ["Owen T", "Duncan M"],
  ["Josh W", "Jordan C"],
  ["Ryan P", "Mike H"],
  ["Adison E", "Jim"],
];
const HISTORICAL = ["Avery", "Jim"]; // create as historical-only players

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // players → id (create historical placeholders if missing)
  const idByName = new Map<string, number>();
  for (const [name, hcp] of ROWS) {
    let [p] = await sql`SELECT id FROM players WHERE name=${name}`;
    if (!p) {
      if (!HISTORICAL.includes(name)) throw new Error(`Unknown player "${name}" (not historical)`);
      [p] = await sql`INSERT INTO players (name, handicap) VALUES (${name}, ${hcp}) RETURNING id`;
      console.log(`  + created historical player "${name}" (id ${p.id})`);
    }
    idByName.set(name, p.id);
  }

  // season 2022 (visible past, not current, no match play)
  let [s] = await sql`SELECT id FROM seasons WHERE year=2022`;
  if (!s) [s] = await sql`INSERT INTO seasons (year) VALUES (2022) RETURNING id`;
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

  // segments: Bluewater 9 (Fri, slope 119) + White Squirrel 3x9 (Sat, slope 118), rating = par
  const seg = async (courseId: number, day: number, sortOrder: number, label: string, slope: number) => {
    const [r] = await sql`INSERT INTO segments
      (season_id, course_id, day, sort_order, label, holes, tee, grint_round, rating, slope, par, date)
      VALUES (${seasonId}, ${courseId}, ${day}, ${sortOrder}, ${label}, 9, null, ${day === 1 ? "F9" : "B9"}, 36.0, ${slope}, 36, null)
      RETURNING id`;
    return r.id as number;
  };
  const friSeg = await seg(bw.id, 1, 1, "Bluewater", 119);
  const satSegs = [
    await seg(ws.id, 2, 2, "White Squirrel — 1st", 118),
    await seg(ws.id, 2, 3, "White Squirrel — 2nd", 118),
    await seg(ws.id, 2, 4, "White Squirrel — 3rd", 118),
  ];

  // rosters (no team) + per-season index, and segment scores
  for (const [name, hcp, fri, sat] of ROWS) {
    const pid = idByName.get(name)!;
    await sql`INSERT INTO season_rosters (season_id, player_id, team_id, handicap_index)
      VALUES (${seasonId}, ${pid}, null, ${hcp})`;
    await sql`INSERT INTO segment_scores (segment_id, player_id, gross) VALUES (${friSeg}, ${pid}, ${fri})`;
    for (let i = 0; i < 3; i++) {
      await sql`INSERT INTO segment_scores (segment_id, player_id, gross) VALUES (${satSegs[i]}, ${pid}, ${sat[i]})`;
    }
  }

  // Saturday pairs
  let order = 1;
  for (const [a, b] of PAIRS) {
    await sql`INSERT INTO day2_teams (season_id, player1_id, player2_id, pick_order, name)
      VALUES (${seasonId}, ${idByName.get(a)!}, ${idByName.get(b)!}, ${order}, ${`${a} & ${b}`})`;
    order++;
  }

  console.log(`✓ 2022 seeded: season ${seasonId}, ${ROWS.length} players, 4 segments, ${PAIRS.length} pairs`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
