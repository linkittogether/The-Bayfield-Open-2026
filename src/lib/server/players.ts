"use server";

import bcrypt from "bcryptjs";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players, seasonRosters } from "@/db/schema";
import { requireAdmin } from "./auth-guards";
import { deletePlayerPhoto, uploadPlayerPhoto } from "./photos";

const PIN_PATTERN = /^\d{4}$/;

const createPlayerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  handicap: z.coerce.number().min(0).default(0),
  pin: z.string().regex(PIN_PATTERN, "PIN must be 4 digits"),
  photoUrl: z.string().nullable().optional(),
});

const updatePlayerSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    handicap: z.coerce.number().min(0).optional(),
    pin: z.string().regex(PIN_PATTERN).optional(),
    photoUrl: z.string().nullable().optional(),
    // Google SSO email. Empty string clears it.
    email: z.union([z.email(), z.literal("")]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field required");

const playerListColumns = {
  id: players.id,
  name: players.name,
  photoUrl: players.photoUrl,
  handicap: players.handicap,
  email: players.email,
  createdAt: players.createdAt,
  hasPin: sql<boolean>`(${players.pinHash} IS NOT NULL AND ${players.pinHash} <> '')`.as(
    "has_pin",
  ),
};

export async function listPlayers() {
  return db
    .select(playerListColumns)
    .from(players)
    .orderBy(asc(players.createdAt));
}

export async function listPlayersByName() {
  return db
    .select(playerListColumns)
    .from(players)
    .orderBy(asc(players.name));
}

/**
 * A season's active participants: the roster minus absent members, with that
 * season's handicap index (falling back to the player's current handicap).
 * This is the source of truth for "who's in season X" — use it instead of
 * listPlayers() anywhere a season's player set is shown.
 */
export async function getActiveRoster(seasonId: number) {
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      photoUrl: players.photoUrl,
      seasonIndex: seasonRosters.handicapIndex,
      globalHandicap: players.handicap,
      isCaptain: seasonRosters.isCaptain,
    })
    .from(seasonRosters)
    .innerJoin(players, eq(players.id, seasonRosters.playerId))
    .where(
      and(eq(seasonRosters.seasonId, seasonId), eq(seasonRosters.absent, false)),
    )
    .orderBy(asc(players.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    photoUrl: r.photoUrl,
    handicap: r.seasonIndex ?? r.globalHandicap,
    isCaptain: r.isCaptain,
  }));
}

export async function getPlayer(id: number) {
  const [row] = await db
    .select(playerListColumns)
    .from(players)
    .where(eq(players.id, id))
    .limit(1);
  return row ?? null;
}

export async function createPlayer(input: z.input<typeof createPlayerSchema>) {
  await requireAdmin();
  const data = createPlayerSchema.parse(input);
  const pinHash = await bcrypt.hash(data.pin, 12);
  const [row] = await db
    .insert(players)
    .values({
      name: data.name,
      handicap: data.handicap,
      pinHash,
      photoUrl: data.photoUrl ?? null,
    })
    .returning({
      id: players.id,
      name: players.name,
      photoUrl: players.photoUrl,
      handicap: players.handicap,
      createdAt: players.createdAt,
    });
  return row;
}

export async function updatePlayer(
  id: number,
  input: z.input<typeof updatePlayerSchema>,
) {
  await requireAdmin();
  const data = updatePlayerSchema.parse(input);
  const update: Partial<typeof players.$inferInsert> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.handicap !== undefined) update.handicap = data.handicap;
  if (data.photoUrl !== undefined) update.photoUrl = data.photoUrl;
  if (data.pin !== undefined) update.pinHash = await bcrypt.hash(data.pin, 12);
  if (data.email !== undefined)
    update.email = data.email ? data.email.toLowerCase() : null;

  const [row] = await db
    .update(players)
    .set(update)
    .where(eq(players.id, id))
    .returning({
      id: players.id,
      name: players.name,
      photoUrl: players.photoUrl,
      handicap: players.handicap,
      email: players.email,
      createdAt: players.createdAt,
    });
  if (!row) throw new Error("Player not found");
  return row;
}

export async function deletePlayer(id: number) {
  await requireAdmin();
  const [existing] = await db
    .select({ photoUrl: players.photoUrl })
    .from(players)
    .where(eq(players.id, id))
    .limit(1);
  const result = await db.delete(players).where(eq(players.id, id));
  if (existing?.photoUrl) {
    await deletePlayerPhoto(existing.photoUrl).catch(() => {});
  }
  return { rowsAffected: result.count };
}

export async function createPlayerFromForm(formData: FormData) {
  await requireAdmin();
  const photo = formData.get("photo");
  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    photoUrl = await uploadPlayerPhoto(photo);
  }
  return createPlayer({
    name: String(formData.get("name") ?? ""),
    handicap: Number(formData.get("handicap") ?? 0),
    pin: String(formData.get("pin") ?? ""),
    photoUrl,
  });
}

export async function updatePlayerFromForm(id: number, formData: FormData) {
  await requireAdmin();

  const update: z.input<typeof updatePlayerSchema> = {};
  const name = formData.get("name");
  const handicap = formData.get("handicap");
  const pin = formData.get("pin");
  const photo = formData.get("photo");

  if (typeof name === "string" && name.trim()) update.name = name;
  if (handicap != null && handicap !== "") update.handicap = Number(handicap);
  if (typeof pin === "string" && pin) update.pin = pin;

  let oldPhotoUrl: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    const [existing] = await db
      .select({ photoUrl: players.photoUrl })
      .from(players)
      .where(eq(players.id, id))
      .limit(1);
    oldPhotoUrl = existing?.photoUrl ?? null;
    update.photoUrl = await uploadPlayerPhoto(photo);
  }

  const row = await updatePlayer(id, update);
  if (oldPhotoUrl) {
    await deletePlayerPhoto(oldPhotoUrl).catch(() => {});
  }
  return row;
}
