import { and, ilike, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";

/**
 * Fetches a player's round history from TheGrint's score feed (the same list you
 * see at https://thegrint.com/score?type_score=0&handicap_company_id=7) and lets
 * you locate a specific round and pull its details.
 *
 * How TheGrint exposes this:
 *   - POST /score/listMoreScores returns an HTML table of a user's rounds. Each
 *     `<tr class="clickable-row">` carries the date, course, tee label, the
 *     DISPLAYED rating/slope%, the gross, and a link containing the scoreId.
 *   - GET  /score/review_score/{scoreId} is the per-round detail page. Its
 *     server-rendered hidden inputs give courseId / tee / index — BUT only for
 *     18-hole rounds. Legacy 9-hole rounds (small scoreIds) return "500-DB".
 *   - GET  /score/ajax_course?course={query} is a course-name autocomplete that
 *     resolves a name to Grint's numeric courseId.
 *
 * Caveats (see docs / the grint-rounds notes):
 *   - The rating/slope in the list are Grint's *display* values (their "msp/mha"),
 *     NOT the exact WHS course rating/slope (their hidden "mr/ms") used to compute
 *     the course handicap. Treat them as informational.
 *   - Auth is the cookie-based session in GRINT_COOKIE (see grint.ts / grint-friends.ts).
 */

const BASE = "https://thegrint.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15";

function requireCookie(): string {
  const cookie = process.env.GRINT_COOKIE;
  if (!cookie) {
    throw new Error(
      "GRINT_COOKIE is not set. Add the logged-in thegrint.com Cookie header to .env.local.",
    );
  }
  return cookie;
}

function headers(cookie: string, extra: Record<string, string> = {}) {
  return {
    "User-Agent": USER_AGENT,
    Cookie: cookie,
    "X-Requested-With": "XMLHttpRequest",
    Origin: BASE,
    Referer: `${BASE}/score?type_score=0&handicap_company_id=7`,
    ...extra,
  };
}

function looksLikeLogin(html: string): boolean {
  return /type=["']password["']/i.test(html) || /forgot your password/i.test(html);
}

export interface GrintRound {
  scoreId: string;
  date: string; // as shown, MM/DD/YY
  isoDate: string; // YYYY-MM-DD (assumes 20YY)
  year: number;
  course: string; // course name, "(9) " prefix stripped
  holes: 9 | 18;
  teeLabel: string; // e.g. "Gold", "White/Blue"
  ratingDisplay: number | null; // rating as SHOWN in the list (not exact WHS mr)
  slopeDisplay: string | null; // slope % as SHOWN in the list (e.g. "97.7%")
  gross: number | null;
  detailUrl: string;
}

/** Parse one listMoreScores HTML page into round rows. */
function parseRounds(html: string): GrintRound[] {
  const out: GrintRound[] = [];
  for (const m of html.matchAll(/<tr class="\s*clickable-row">([\s\S]*?)<\/tr>/g)) {
    const block = m[1];
    const scoreId = block.match(/(?:edit_score|review_score)\/(\d+)/)?.[1];
    if (!scoreId) continue;

    const date = block.match(/(\d{2}\/\d{2}\/\d{2})/)?.[1] ?? "";
    const [mm, dd, yy] = date.split("/");
    const year = yy ? 2000 + Number(yy) : 0;
    const isoDate = date ? `${year}-${mm}-${dd}` : "";

    const courseCell = block.match(/<td class="text-18"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? "";
    let course = courseCell.match(/^\s*([^<]+?)\s*</)?.[1]?.trim() ?? "";
    const nine = /^\(9\)/.test(course);
    course = course.replace(/^\(9\)\s*/, "").trim();

    // Tee line, e.g. "Gold 70.7 | 97.7%" or "White/Blue 34.9 | 52.3%".
    const teeLine = courseCell.match(/<p[^>]*>\s*([^<]+?)\s*<\/p>/)?.[1]?.trim() ?? "";
    const teeMatch = teeLine.match(/^(.*?)\s+([\d.]+)\s*\|\s*([\d.]+%)\s*$/);
    const teeLabel = (teeMatch?.[1] ?? teeLine).trim();
    const ratingDisplay = teeMatch ? Number(teeMatch[2]) : null;
    const slopeDisplay = teeMatch ? teeMatch[3] : null;

    const grossStr = block.match(/tg-circle">\s*<div[^>]*>\s*(\d+)\s*<\/div>/)?.[1];
    const gross = grossStr ? Number(grossStr) : null;

    out.push({
      scoreId,
      date,
      isoDate,
      year,
      course,
      holes: nine ? 9 : 18,
      teeLabel,
      ratingDisplay,
      slopeDisplay,
      gross,
      // 9-hole rounds need the "/9" holes segment in the path; 18-hole don't.
      detailUrl: `${BASE}/score/edit_score/${scoreId}${nine ? "/9" : ""}?handicap_company_id=7`,
    });
  }
  return out;
}

export interface FetchRoundsOptions {
  companyId?: number; // handicap_company_id, default 7
  typeScore?: number; // type_score filter, default 0
  maxPages?: number; // safety cap, default 40
}

/**
 * Fetch a user's full round history. TheGrint pages the feed via a `wave` cursor;
 * we advance it, dedupe by scoreId, and stop as soon as a page yields no NEW
 * rounds (or is empty). Returns newest-first (Grint's order), deduped.
 */
export async function fetchRounds(
  userId: number | string,
  opts: FetchRoundsOptions = {},
): Promise<GrintRound[]> {
  const cookie = requireCookie();
  const companyId = opts.companyId ?? 7;
  const typeScore = opts.typeScore ?? 0;
  const maxPages = opts.maxPages ?? 40;

  const byId = new Map<string, GrintRound>();
  for (let wave = 1; wave <= maxPages; wave++) {
    const body = new URLSearchParams({
      wave: String(wave),
      wave18: "0",
      wave9: "0",
      userId: String(userId),
      courseId: "",
      typeScore: String(typeScore),
      handicap_company_id: String(companyId),
    }).toString();

    const res = await fetch(`${BASE}/score/listMoreScores`, {
      method: "POST",
      headers: headers(cookie, { "Content-Type": "application/x-www-form-urlencoded" }),
      body,
    });
    if (!res.ok) throw new Error(`listMoreScores wave ${wave}: HTTP ${res.status}`);
    const html = await res.text();
    if (looksLikeLogin(html)) {
      throw new Error("GRINT_COOKIE is expired / not logged in.");
    }

    const rows = parseRounds(html);
    let added = 0;
    for (const r of rows) {
      if (!byId.has(r.scoreId)) {
        byId.set(r.scoreId, r);
        added++;
      }
    }
    // Empty page or a page that contributes nothing new → we've seen it all.
    if (rows.length === 0 || added === 0) break;

    await new Promise((r) => setTimeout(r, 300)); // be gentle
  }

  return [...byId.values()];
}

export interface RoundFilter {
  course?: string; // case-insensitive substring
  year?: number;
  holes?: 9 | 18;
}

/** Filter fetched rounds. Course match is a case-insensitive substring. */
export function findRounds(rounds: GrintRound[], f: RoundFilter): GrintRound[] {
  const needle = f.course?.toLowerCase();
  return rounds.filter(
    (r) =>
      (needle === undefined || r.course.toLowerCase().includes(needle)) &&
      (f.year === undefined || r.year === f.year) &&
      (f.holes === undefined || r.holes === f.holes),
  );
}

export interface CourseMatch {
  id: string;
  name: string;
  url: string;
}

/**
 * Resolve a course name to Grint's courseId(s). The search endpoint takes the
 * query as a PATH segment (`/score/ajax_course/{query}`); passing it as a query
 * param is silently ignored and returns a default list.
 */
export async function resolveCourse(query: string): Promise<CourseMatch[]> {
  const cookie = requireCookie();
  const res = await fetch(
    `${BASE}/score/ajax_course/${encodeURIComponent(query)}`,
    { headers: headers(cookie) },
  );
  if (!res.ok) throw new Error(`ajax_course: HTTP ${res.status}`);
  const html = await res.text();
  const out: CourseMatch[] = [];
  for (const m of html.matchAll(
    /course-id="(\d+)"\s+course-name="([^"]*)"(?:\s+course-url="([^"]*)")?/g,
  )) {
    out.push({ id: m[1], name: m[2], url: m[3] ?? "" });
  }
  return out;
}

export interface CourseTee {
  tee: string;
  rating: number | null; // 18-hole men's course rating (Grint "mr")
  slope: number | null; // men's slope (Grint "ms")
}

/**
 * List a course's tees with their men's rating/slope, via
 * `GET /score/ajax_tees/{courseId}` (path param). Tees whose men's rating is
 * blank (e.g. ladies-only combos) are dropped.
 */
export async function listCourseTees(courseId: number | string): Promise<CourseTee[]> {
  const cookie = requireCookie();
  const res = await fetch(`${BASE}/score/ajax_tees/${courseId}`, { headers: headers(cookie) });
  if (!res.ok) throw new Error(`ajax_tees: HTTP ${res.status}`);
  const html = await res.text();
  const out: CourseTee[] = [];
  for (const m of html.matchAll(/<option[^>]*value="([^"]+)"[^>]*>/g)) {
    const opt = m[0];
    const tee = m[1];
    const mr = opt.match(/\bmr="([^"]*)"/)?.[1];
    const ms = opt.match(/\bms="([^"]*)"/)?.[1];
    const rating = mr && /^[\d.]+$/.test(mr) ? Number(mr) : null;
    const slope = ms && /^[\d.]+$/.test(ms) ? Number(ms) : null;
    if (rating !== null) out.push({ tee, rating, slope });
  }
  return out;
}

/**
 * A player's per-hole gross for one round. The scorecard editor page renders
 * them as `<input class="input-score-field" value="N" data-hole="H" name="scHN">`
 * — server-rendered, so this works for any friend's round (9- or 18-hole).
 */
export async function fetchHoleScores(
  scoreId: number | string,
  holes: 9 | 18 = 18,
): Promise<{ holeNumber: number; gross: number }[]> {
  const cookie = requireCookie();
  const url = `${BASE}/score/edit_score/${scoreId}${holes === 9 ? "/9" : ""}?handicap_company_id=7`;
  const res = await fetch(url, { headers: headers(cookie) });
  const html = await res.text();
  if (!res.ok || /500-DB/.test(html)) {
    throw new Error(`could not load scorecard for ${scoreId} (HTTP ${res.status})`);
  }
  if (looksLikeLogin(html)) throw new Error("GRINT_COOKIE is expired / not logged in.");

  // The gross-score row is the `name="scH{hole}"` inputs. There are other
  // input-score-field rows (adjusted gross, etc.) with the same data-hole, so
  // key on the scH name and keep the FIRST occurrence per hole. Strip
  // `data-value="…"` first so it isn't mistaken for the `value` attribute.
  const byHole = new Map<number, number>();
  for (const m of html.matchAll(/<input[^>]*class="input-score-field"[^>]*>/g)) {
    const tag = m[0];
    const hole = Number(tag.match(/name="scH(\d+)"/)?.[1] ?? "");
    if (!hole || byHole.has(hole)) continue;
    const val = tag.replace(/data-value="[^"]*"/, "").match(/value="(\d+)"/)?.[1];
    if (val != null) byHole.set(hole, Number(val));
  }
  return [...byHole.entries()]
    .map(([holeNumber, gross]) => ({ holeNumber, gross }))
    .sort((a, b) => a.holeNumber - b.holeNumber);
}

export interface CourseData {
  rating: number | null;
  slope: number | null;
  par: number | null;
  holes: { holeNumber: number; par: number | null; strokeIndex: number | null }[];
}

// Any valid Grint user id is needed as calling context for get_course_data; the
// organizer's works. Overridable per call.
const CONTEXT_GRINT_USER = 992313;

/**
 * Fetch a course/tee's rating, slope, par, and per-hole par + stroke index.
 * `round` is "18" (default), "F9", or "B9" for a 9-hole scope. Works from the
 * courseId alone — no played round needed.
 *
 * rating/slope come from get_course_hdcp (correct per scope — its `rating`
 * scalar reflects 9- vs 18-hole, unlike get_course_data which always reports the
 * 18-hole rating); par + per-hole stroke index come from get_course_data.
 */
export async function fetchCourseData(
  courseId: number | string,
  tee: string,
  round: string = "18",
  contextUserId: number = CONTEXT_GRINT_USER,
): Promise<CourseData> {
  const cookie = requireCookie();
  const num = (v: unknown) =>
    v != null && /^-?[\d.]+$/.test(String(v)) ? Number(v) : null;

  // rating/slope (scope-correct)
  const hdcpRes = await fetch(
    `${BASE}/ajax/get_course_hdcp/${contextUserId}/${courseId}/0/${round}/0`,
    {
      method: "POST",
      headers: headers(cookie, { "Content-Type": "application/x-www-form-urlencoded" }),
      body: new URLSearchParams({
        user_id: String(contextUserId),
        course_id: String(courseId),
        tee,
        round,
        score_id: "0",
        handicap_company_id: "7",
      }).toString(),
    },
  );
  if (!hdcpRes.ok) throw new Error(`get_course_hdcp: HTTP ${hdcpRes.status}`);
  const hd = JSON.parse(await hdcpRes.text());

  // par + per-hole par/stroke-index
  const res = await fetch(`${BASE}/ajax/get_course_data/0/0/0`, {
    method: "POST",
    headers: headers(cookie, { "Content-Type": "application/x-www-form-urlencoded" }),
    body: new URLSearchParams({
      course_id: String(courseId),
      tee,
      user_id: String(contextUserId),
      round,
      score_id: "0",
      handicap_company_id: "7",
    }).toString(),
  });
  if (!res.ok) throw new Error(`get_course_data: HTTP ${res.status}`);
  const j = JSON.parse(await res.text());

  // Per-hole cells carry the hole number in their class ("… gray-text 7">).
  const byHole = (frag: unknown) => {
    const map = new Map<number, number>();
    for (const m of String(frag ?? "").matchAll(/gray-text\s+(\d+)"[^>]*>\s*(\d+)\s*</g)) {
      map.set(Number(m[1]), Number(m[2]));
    }
    return map;
  };
  const pars = byHole(j.par);
  const idx = byHole(j.handicap);
  const holeNums = [...new Set([...pars.keys(), ...idx.keys()])].sort((a, b) => a - b);
  const holes = holeNums.map((h) => ({
    holeNumber: h,
    par: pars.get(h) ?? null,
    strokeIndex: idx.get(h) ?? null,
  }));

  return { rating: num(hd.rating), slope: num(hd.slope), par: num(j.coursePar), holes };
}

export interface ScoreDetail {
  ok: boolean;
  scoreId: string;
  note?: string;
  userId?: string;
  courseId?: string;
  courseName?: string;
  tee?: string;
  round?: string; // Grint's round code: "18", "F9" (front 9), "B9" (back 9)
  index?: number; // handicap_ghap at time of entry
  differential?: number;
  // Authoritative WHS inputs, from get_course_hdcp (rating/par are for the round's
  // hole count — i.e. the 9-hole rating/par for a 9-hole round):
  rating?: number; // true WHS course rating (Grint's "mr")
  slope?: number; // true WHS slope (Grint's "ms")
  courseHandicap?: number; // strokes Grint applied for this round
  statisticalPar?: number; // Grint's DISPLAYED rating (the list's "70.7")
}

const num = (v?: string) => (v && /^-?[\d.]+$/.test(v) ? Number(v) : undefined);

/**
 * Ask TheGrint for the authoritative rating/slope/course-handicap it used for a
 * round: POST /ajax/get_course_hdcp/{user}/{course}/0/{round}/{scoreId}. Returns
 * clean JSON, e.g. {"rating":"68.50","slope":"123","courseHdcp":"21.0",...}.
 */
async function getCourseHdcp(
  cookie: string,
  p: { userId: string; courseId: string; round: string; scoreId: string; tee: string },
): Promise<Partial<ScoreDetail>> {
  const url = `${BASE}/ajax/get_course_hdcp/${p.userId}/${p.courseId}/0/${p.round}/${p.scoreId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(cookie, { "Content-Type": "application/x-www-form-urlencoded" }),
    body: new URLSearchParams({
      user_id: p.userId,
      course_id: p.courseId,
      tee: p.tee,
      round: p.round,
      score_id: p.scoreId,
      handicap_company_id: "7",
    }).toString(),
  });
  if (!res.ok) return {};
  try {
    const j = JSON.parse(await res.text());
    return {
      rating: num(j.rating),
      slope: num(j.slope),
      courseHandicap: num(j.courseHdcp),
      statisticalPar: num(j.statistical_par),
    };
  } catch {
    return {};
  }
}

/**
 * Fetch a round's full detail: opens the scorecard editor page (the "View" link),
 * parses its server-rendered hidden inputs (courseId / tee / round code / index),
 * then calls get_course_hdcp for the authoritative rating / slope / course handicap.
 * Works for BOTH 9- and 18-hole rounds. Pass the round's `holes` (from the list) so
 * the "/9" path segment is included for 9-hole rounds; otherwise we try 18 then 9.
 */
export async function fetchScoreDetail(
  scoreId: string | number,
  opts: { holes?: 9 | 18 } = {},
): Promise<ScoreDetail> {
  const cookie = requireCookie();
  const id = String(scoreId);

  const attempts: (9 | 18)[] = opts.holes ? [opts.holes] : [18, 9];
  let html = "";
  let loaded = false;
  for (const holes of attempts) {
    const url = `${BASE}/score/edit_score/${id}${holes === 9 ? "/9" : ""}?handicap_company_id=7`;
    const res = await fetch(url, { headers: headers(cookie) });
    html = await res.text();
    if (res.ok && !/500-DB/.test(html)) {
      loaded = true;
      break;
    }
  }
  if (!loaded) return { ok: false, scoreId: id, note: "could not load detail page" };
  if (looksLikeLogin(html)) return { ok: false, scoreId: id, note: "cookie expired" };

  const hidden = (id2: string, cls = false) => {
    const re = cls
      ? new RegExp(`class="${id2}"[^>]*value="([^"]*)"`)
      : new RegExp(`id="${id2}"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*id="${id2}"`);
    const m = html.match(re);
    return (m?.[1] ?? m?.[2])?.trim();
  };

  const detail: ScoreDetail = {
    ok: true,
    scoreId: id,
    userId: hidden("userid1"),
    courseId: hidden("cid"),
    courseName: hidden("cname"),
    tee: hidden("tees-db", true) ?? hidden("orignal-sc-tees", true),
    round: hidden("round"),
    index: num(hidden("handicap_ghap")),
    differential: num(hidden("orignal-sc-diff", true)),
  };

  if (detail.userId && detail.courseId && detail.round && detail.tee) {
    Object.assign(
      detail,
      await getCourseHdcp(cookie, {
        userId: detail.userId,
        courseId: detail.courseId,
        round: detail.round,
        scoreId: id,
        tee: detail.tee,
      }),
    );
  }

  return detail;
}

/** Resolve a DB player (by name substring) to their Grint userId. */
export async function grintIdForPlayer(
  nameQuery: string,
): Promise<{ id: number; name: string; grintId: number }[]> {
  return db
    .select({ id: players.id, name: players.name, grintId: players.grintId })
    .from(players)
    .where(and(ilike(players.name, `%${nameQuery}%`), isNotNull(players.grintId)))
    .then((rows) =>
      rows
        .filter((r): r is { id: number; name: string; grintId: number } => r.grintId !== null)
        .map((r) => ({ id: r.id, name: r.name, grintId: r.grintId })),
    );
}
