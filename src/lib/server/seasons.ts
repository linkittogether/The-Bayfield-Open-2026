"use server";

import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { seasons } from "@/db/schema";
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
