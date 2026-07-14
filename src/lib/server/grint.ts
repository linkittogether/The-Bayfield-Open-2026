import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
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
