import postgres from "postgres";

// 2024 Bayfield Open — reconstructed from Grint event leaderboards + WhatsApp
// (see scratchpad 2024-import.md). The event used its OWN handicaps (not WHS),
// so NET is stored directly via segment_scores.net_override; gross is the real
// gross where known, else backed out (net + course handicap).
//
// Structure: Fri Bluewater 9 (individual) | Sat White Squirrel 9 + 18 (pairs).
// Sunday Ironwood match play is deferred -> matchPlay=false (Day 3 greyed).
//
// Per player: [dbShortName, index, BW9 [g,n], WS9 [g,n]|null, WS18 [g,n]|null]
// null = score genuinely lost -> that player/pair shows "?" (incomplete).
const ROWS: [string, number, [number, number], [number, number] | null, [number, number] | null][] = [
  ["Mike P", 17.5, [50, 40], [40, 32], [89, 72]],
  ["Adison E", 2.5, [39, 38], [34, 32], [72, 71]],
  ["Ryan P", 15.2, [50, 43], [50, 43], [88, 74]],
  ["Spencer C", 7.4, [46, 44], [55, 51], [77, 71]],
  ["Duncan M", 17, [49, 41], [49, 42], [85, 70]],
  ["Phil H", 9.7, [42, 37], [39, 34], null], // WS18 lost (DNF pair, no Grint)
  ["Josh W", 18.6, [47, 38], [45, 36], [95, 78]],
  ["Jordan H", 2.7, [39, 38], [46, 44], [74, 72]],
  ["Scott M", 12.7, [45, 39], null, [92, 76]], // WS9 not on the front-9 board
  ["Korey B", 25.7, [52, 39], null, [99, 75]], // WS9 not on the front-9 board
  ["Travis W", 11.8, [41, 35], [40, 34], [85, 75]],
  ["John L", 14.6, [46, 39], [47, 41], [90, 77]],
  ["James P", 28.8, [51, 36], [50, 36], [114, 88]],
  ["Owen T", 18.4, [53, 44], [49, 40], null], // WS18 lost (DNF pair, no Grint)
  ["Chris G", 13.8, [48, 38], [47, 38], [95, 76]],
  ["Daniel C", 30.7, [57, 41], [53, 38], [106, 78]],
  ["Mike H", 12.7, [45, 39], [39, 33], [97, 86]],
  ["Dave G", 10.7, [44, 39], [48, 43], [86, 77]],
  ["Rob V", 20, [47, 37], [48, 38], [103, 85]],
  ["Grant M", 14, [50, 43], [49, 42], [94, 82]],
];
// Saturday partner pairs (draft order). No DQ — incomplete pairs surface as "?".
const PAIRS: [string, string][] = [
  ["Mike P", "Adison E"],
  ["Ryan P", "Spencer C"],
  ["Duncan M", "Phil H"],
  ["Josh W", "Jordan H"],
  ["Scott M", "Korey B"],
  ["Travis W", "John L"],
  ["James P", "Owen T"],
  ["Chris G", "Daniel C"],
  ["Mike H", "Dave G"],
  ["Rob V", "Grant M"],
];
// Subs new to 2024 (create if missing) with full names.
const NEW: Record<string, string> = { "Phil H": "Phil Hipkiss", "John L": "John Laurencic" };

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const idByName = new Map<string, number>();
  for (const [name, idx] of ROWS) {
    let [p] = await sql`SELECT id FROM players WHERE name=${name}`;
    if (!p) {
      const full = NEW[name];
      if (!full) throw new Error(`Unknown player "${name}" (not a known sub)`);
      [p] = await sql`INSERT INTO players (name, full_name, handicap) VALUES (${name}, ${full}, ${idx}) RETURNING id`;
      console.log(`  + created player "${name}" (${full}, id ${p.id})`);
    }
    idByName.set(name, p.id);
  }

  // season 2024 (season id 4; visible past, not current, no match play yet)
  let [s] = await sql`SELECT id FROM seasons WHERE year=2024`;
  if (!s) [s] = await sql`INSERT INTO seasons (year) VALUES (2024) RETURNING id`;
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

  // fresh slate
  const segIds = (await sql`SELECT id FROM segments WHERE season_id=${seasonId}`).map((r) => r.id);
  if (segIds.length) await sql`DELETE FROM segment_scores WHERE segment_id IN ${sql(segIds)}`;
  await sql`DELETE FROM segments WHERE season_id=${seasonId}`;
  await sql`DELETE FROM day2_teams WHERE season_id=${seasonId}`;
  await sql`DELETE FROM season_rosters WHERE season_id=${seasonId}`;

  // segments (net stored via override, so rating/slope/par are placeholders)
  const seg = async (courseId: number, day: number, sortOrder: number, label: string, holes: number, par: number) => {
    const [r] = await sql`INSERT INTO segments
      (season_id, course_id, day, sort_order, label, holes, tee, grint_round, rating, slope, par, date)
      VALUES (${seasonId}, ${courseId}, ${day}, ${sortOrder}, ${label}, ${holes}, null, ${holes === 9 ? "F9" : "18"}, ${par}, 113, ${par}, null)
      RETURNING id`;
    return r.id as number;
  };
  const bwSeg = await seg(bw.id, 1, 1, "Bluewater", 9, 36);
  const ws9Seg = await seg(ws.id, 2, 2, "White Squirrel — 9", 9, 35);
  const ws18Seg = await seg(ws.id, 2, 3, "White Squirrel — 18", 18, 71);

  const putScore = async (segId: number, pid: number, gn: [number, number] | null) => {
    if (!gn) return; // unplayed / lost -> no row (renders as "?")
    await sql`INSERT INTO segment_scores (segment_id, player_id, gross, net_override)
      VALUES (${segId}, ${pid}, ${gn[0]}, ${gn[1]})`;
  };

  for (const [name, idx, bw9, ws9, ws18] of ROWS) {
    const pid = idByName.get(name)!;
    await sql`INSERT INTO season_rosters (season_id, player_id, team_id, handicap_index)
      VALUES (${seasonId}, ${pid}, null, ${idx})`;
    await putScore(bwSeg, pid, bw9);
    await putScore(ws9Seg, pid, ws9);
    await putScore(ws18Seg, pid, ws18);
  }

  let order = 1;
  for (const [a, b] of PAIRS) {
    await sql`INSERT INTO day2_teams (season_id, player1_id, player2_id, pick_order, name)
      VALUES (${seasonId}, ${idByName.get(a)!}, ${idByName.get(b)!}, ${order}, ${`${a} & ${b}`})`;
    order++;
  }

  console.log(`✓ 2024 seeded: season ${seasonId}, ${ROWS.length} players, 3 segments, ${PAIRS.length} pairs`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
