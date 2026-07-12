"use server";

import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requireAdmin } from "./auth-guards";

export type Season = typeof seasons.$inferSelect;

const VIEWED_SEASON_COOKIE = "bayfield_viewed_season";

export async function getCurrentSeason(): Promise<Season> {
  const [row] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isCurrent, true))
    .limit(1);
  if (!row) throw new Error("No current season is configured");
  return row;
}

export async function getCurrentSeasonId(): Promise<number> {
  return (await getCurrentSeason()).id;
}

export async function listSeasons(): Promise<Season[]> {
  return db.select().from(seasons).orderBy(desc(seasons.year));
}

export async function getSeasonByYear(year: number): Promise<Season | null> {
  const [row] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.year, year))
    .limit(1);
  return row ?? null;
}

export async function getSeasonById(id: number): Promise<Season | null> {
  const [row] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * The season the viewer is currently browsing (from the bayfield_viewed_season
 * cookie), defaulting to the current season when the cookie is missing/invalid.
 * Reads never mutate; the season selector sets the cookie via selectSeason().
 */
export async function getViewedSeason(): Promise<Season> {
  const store = await cookies();
  const raw = store.get(VIEWED_SEASON_COOKIE)?.value;
  if (raw) {
    const year = Number(raw);
    if (Number.isFinite(year)) {
      const s = await getSeasonByYear(year);
      if (s) return s;
    }
  }
  return getCurrentSeason();
}

/**
 * Convenience for pages: the viewed season, the current season, and whether the
 * view is read-only (i.e. a past season). Writes are still enforced server-side.
 */
export async function getSeasonView() {
  const [viewed, current] = await Promise.all([
    getViewedSeason(),
    getCurrentSeason(),
  ]);
  return { viewed, current, readOnly: viewed.id !== current.id };
}

/** Throws unless seasonId is the current season — the real read-only gate. */
export async function assertCurrentSeason(seasonId: number): Promise<void> {
  const current = await getCurrentSeason();
  if (current.id !== seasonId) {
    throw new Error("This action is only allowed on the current season");
  }
}

/** Admin: make a season the current one (only one can be current). */
export async function setCurrentSeason(seasonId: number) {
  await requireAdmin();
  await db.transaction(async (tx) => {
    await tx
      .update(seasons)
      .set({ isCurrent: false })
      .where(eq(seasons.isCurrent, true));
    await tx
      .update(seasons)
      .set({ isCurrent: true })
      .where(eq(seasons.id, seasonId));
  });
  return { ok: true };
}

/** Sets which season the viewer is browsing (public — view only). */
export async function selectSeason(year: number) {
  const season = await getSeasonByYear(year);
  if (!season) throw new Error("Unknown season");
  const store = await cookies();
  store.set(VIEWED_SEASON_COOKIE, String(year), {
    path: "/",
    sameSite: "lax",
  });
  return { ok: true };
}
