import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { players, seasonRosters } from "@/db/schema";
import { grintGet } from "./grint-rounds";

/**
 * Pulls player handicaps from TheGrint by fetching each player's profile page
 * (keyed by their grint_id) and updating the players table. Re-runnable: every
 * run re-fetches and overwrites, bumping updated_at.
 *
 * Auth: reuses the cookie-based session in GRINT_COOKIE (see grint-friends.ts).
 *
 * This module is deliberately guard-free so it can run both from the
 * `grint:handicaps` script and, later, from an admin-guarded server action
 * behind the "refresh handicaps" UI button.
 */

const profileUrl = (grintId: number) =>
  `https://thegrint.com/profile/index/${grintId}`;

export type HandicapParse =
  | { kind: "exact"; value: number; raw: string }
  | { kind: "band"; value: number; raw: string } // value = band midpoint
  | { kind: "none"; raw: string };

/**
 * Extracts the handicap from the right-sidebar "Averages" card:
 *   <div class="tg-circle lh-1"><div class=" green|gray"> VALUE </div></div> Handicap
 * VALUE is an exact index for visible friends ("21.3"), a ±1 band for masked
 * friends ("15~17"), or "..." when not established. Bands resolve to their
 * midpoint (15~17 -> 16).
 */
export function parseProfileHandicap(html: string): HandicapParse {
  const flat = html.replace(/\s+/g, " ");
  const m = flat.match(
    /tg-circle[^"]*">\s*<div[^>]*>\s*([^<]+?)\s*<\/div>\s*<\/div>\s*Handicap/i,
  );
  const raw = (m?.[1] ?? "").trim();

  const band = raw.match(/^(\d+(?:\.\d+)?)\s*[~-]\s*(\d+(?:\.\d+)?)$/);
  if (band) {
    const mid = (parseFloat(band[1]) + parseFloat(band[2])) / 2;
    return { kind: "band", value: Math.round(mid * 10) / 10, raw };
  }
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return { kind: "exact", value: parseFloat(raw), raw };
  }
  return { kind: "none", raw };
}

function looksLikeLogin(html: string): boolean {
  return (
    /type=["']password["']/i.test(html) || /forgot your password/i.test(html)
  );
}

export interface RefreshResult {
  updated: {
    id: number;
    name: string;
    grintId: number;
    handicap: number;
    source: "exact" | "band-midpoint";
  }[];
  skipped: { id: number; name: string; grintId: number; reason: string }[];
}

export async function refreshHandicaps(): Promise<RefreshResult> {
  const rows = await db
    .select({ id: players.id, name: players.name, grintId: players.grintId })
    .from(players)
    .where(isNotNull(players.grintId));

  const result: RefreshResult = { updated: [], skipped: [] };

  for (const row of rows) {
    const grintId = row.grintId as number;
    const base = { id: row.id, name: row.name, grintId };

    let html: string;
    try {
      const { res, text } = await grintGet(profileUrl(grintId));
      if (!res.ok) {
        result.skipped.push({ ...base, reason: `HTTP ${res.status}` });
        continue;
      }
      html = text;
    } catch (e) {
      result.skipped.push({
        ...base,
        reason: `fetch failed: ${(e as Error).message}`,
      });
      continue;
    }

    if (looksLikeLogin(html)) {
      result.skipped.push({ ...base, reason: "cookie expired / not logged in" });
      continue;
    }

    const parsed = parseProfileHandicap(html);
    if (parsed.kind === "none") {
      result.skipped.push({
        ...base,
        reason: `no handicap found ("${parsed.raw || "empty"}")`,
      });
      continue;
    }

    await db
      .update(players)
      .set({ handicap: parsed.value })
      .where(eq(players.id, row.id));

    result.updated.push({
      ...base,
      handicap: parsed.value,
      source: parsed.kind === "band" ? "band-midpoint" : "exact",
    });

    // be gentle to TheGrint between profile requests
    await new Promise((r) => setTimeout(r, 350));
  }

  return result;
}

/** Fetches + parses one player's current handicap from their Grint profile. */
async function fetchHandicap(
  grintId: number,
): Promise<
  | { ok: true; parsed: HandicapParse }
  | { ok: false; reason: string }
> {
  let html: string;
  try {
    const { res, text } = await grintGet(profileUrl(grintId));
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    html = text;
  } catch (e) {
    return { ok: false, reason: `fetch failed: ${(e as Error).message}` };
  }
  if (looksLikeLogin(html)) {
    return { ok: false, reason: "cookie expired / not logged in" };
  }
  return { ok: true, parsed: parseProfileHandicap(html) };
}

export interface RosterHandicapResult {
  updated: {
    playerId: number;
    name: string;
    handicap: number;
    source: "exact" | "band-midpoint";
  }[];
  skipped: { playerId: number; name: string; reason: string }[];
}

/**
 * Pulls fresh handicaps from TheGrint for every member of one season's roster
 * and writes the value to that season's `handicapIndex` (what scoring uses),
 * while also refreshing the global `players.handicap` convenience value.
 * Re-runnable. Roster members without a Grint link, or whose profile has no
 * established handicap, are reported as skipped.
 *
 * Guard-free like refreshHandicaps — the admin server action wraps this with
 * requireAdmin + current-season enforcement.
 */
export async function refreshRosterHandicaps(
  seasonId: number,
): Promise<RosterHandicapResult> {
  const rows = await db
    .select({
      playerId: players.id,
      name: players.name,
      grintId: players.grintId,
      locked: seasonRosters.handicapLocked,
    })
    .from(seasonRosters)
    .innerJoin(players, eq(players.id, seasonRosters.playerId))
    .where(eq(seasonRosters.seasonId, seasonId))
    .orderBy(players.name);

  const result: RosterHandicapResult = { updated: [], skipped: [] };

  for (const row of rows) {
    const base = { playerId: row.playerId, name: row.name };

    // Manually locked handicaps are protected from pulls.
    if (row.locked) {
      result.skipped.push({ ...base, reason: "locked (manual)" });
      continue;
    }

    if (row.grintId == null) {
      result.skipped.push({ ...base, reason: "no Grint account linked" });
      continue;
    }

    const res = await fetchHandicap(row.grintId);
    if (!res.ok) {
      result.skipped.push({ ...base, reason: res.reason });
      continue;
    }
    if (res.parsed.kind === "none") {
      result.skipped.push({
        ...base,
        reason: `no handicap found ("${res.parsed.raw || "empty"}")`,
      });
      continue;
    }

    const value = res.parsed.value;
    await db
      .update(seasonRosters)
      .set({ handicapIndex: value })
      .where(
        and(
          eq(seasonRosters.seasonId, seasonId),
          eq(seasonRosters.playerId, row.playerId),
        ),
      );
    await db
      .update(players)
      .set({ handicap: value })
      .where(eq(players.id, row.playerId));

    result.updated.push({
      ...base,
      handicap: value,
      source: res.parsed.kind === "band" ? "band-midpoint" : "exact",
    });

    // be gentle to TheGrint between profile requests
    await new Promise((r) => setTimeout(r, 350));
  }

  return result;
}
