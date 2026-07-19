"use server";

import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { seasons } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { requireAdmin } from "./auth-guards";

export type Season = typeof seasons.$inferSelect;

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
  // Hidden seasons (dry-run sandboxes) are excluded from the switcher.
  return db
    .select()
    .from(seasons)
    .where(eq(seasons.hidden, false))
    .orderBy(desc(seasons.year));
}

/**
 * The season regular users should land on. Normally the current season, but if
 * the current season is hidden (e.g. a dry-run sandbox is temporarily made
 * current so it's writable), fall back to the most recent visible season so the
 * public home page never routes people into the sandbox.
 */
export async function getLandingSeason(): Promise<Season> {
  const current = await getCurrentSeason();
  if (!current.hidden) return current;
  const [latestVisible] = await listSeasons(); // non-hidden, year desc
  return latestVisible ?? current;
}

export async function getSeasonByYear(year: number): Promise<Season | null> {
  // Non-numeric /[year] paths (e.g. browsers fetching /apple-touch-icon.png)
  // arrive as NaN; short-circuit so we never send "NaN" to Postgres.
  if (!Number.isInteger(year)) return null;
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
 * Convenience for pages: the viewed season (from the /[year] path segment), the
 * current season, and whether the view is read-only (a past season). Writes are
 * still enforced server-side. 404s if the year isn't a real season.
 */
export async function getSeasonView(year: number) {
  const [viewed, current] = await Promise.all([
    getSeasonByYear(year),
    getCurrentSeason(),
  ]);
  if (!viewed) notFound();
  // Hidden (dry-run) seasons stay out of the switcher (see listSeasons) but are
  // reachable by direct URL for admins only — everyone else still 404s.
  if (viewed.hidden && viewed.id !== current.id) {
    const user = await getCurrentUser();
    if (user?.kind !== "admin") notFound();
  }
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
