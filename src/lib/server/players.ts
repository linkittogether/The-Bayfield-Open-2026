"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players, seasonRosters, seasons } from "@/db/schema";
import { requireAdmin } from "./auth-guards";
import { deletePlayerPhoto, uploadPlayerPhoto } from "./photos";

const PIN_PATTERN = /^\d{4}$/;

const createPlayerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  handicap: z.coerce.number().min(0).default(0),
  // Optional: PINs are assigned by an admin later, in the player editor.
  pin: z.string().regex(PIN_PATTERN, "PIN must be 4 digits").optional(),
  photoUrl: z.string().nullable().optional(),
});

// A PIN identifies a player on its own at login, so it must be globally unique.
// There's a DB unique constraint too (players.pin) — this gives a friendly error
// before we hit it, and lets us scope the check to "other" players on update.
async function assertPinUnique(pin: string, exceptPlayerId?: number) {
  const [taken] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.pin, pin))
    .limit(1);
  if (taken && taken.id !== exceptPlayerId) {
    throw new Error("That PIN is already in use — choose a different one.");
  }
}

const updatePlayerSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    handicap: z.coerce.number().min(0).optional(),
    pin: z.string().regex(PIN_PATTERN).optional(),
    photoUrl: z.string().nullable().optional(),
    // Google SSO email. Empty string clears it.
    email: z.union([z.email(), z.literal("")]).optional(),
    isAdmin: z.boolean().optional(),
    // Pin the current season's handicap so a Grint pull won't overwrite it.
    handicapLocked: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field required");

const playerListColumns = {
  id: players.id,
  name: players.name,
  photoUrl: players.photoUrl,
  handicap: players.handicap,
  email: players.email,
  isAdmin: players.isAdmin,
  createdAt: players.createdAt,
  // Plaintext login PIN (null = none). Only ever selected into admin-gated views.
  pin: players.pin,
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
  if (data.pin) await assertPinUnique(data.pin);
  const [row] = await db
    .insert(players)
    .values({
      name: data.name,
      handicap: data.handicap,
      pin: data.pin ?? null,
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
  if (data.pin !== undefined) {
    await assertPinUnique(data.pin, id);
    update.pin = data.pin;
  }
  if (data.email !== undefined)
    update.email = data.email ? data.email.toLowerCase() : null;
  if (data.isAdmin !== undefined) update.isAdmin = data.isAdmin;

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
      isAdmin: players.isAdmin,
      createdAt: players.createdAt,
    });
  if (!row) throw new Error("Player not found");

  // Sync the CURRENT season's roster row. Scoring reads
  // seasonRosters.handicapIndex (not players.handicap), so a manual handicap
  // edit must land there too — and a manual set should LOCK the value so a
  // later Grint pull doesn't silently overwrite it.
  const rosterSet: Partial<typeof seasonRosters.$inferInsert> = {};
  if (data.handicap !== undefined) {
    rosterSet.handicapIndex = data.handicap;
    // Auto-lock on manual edit unless the caller explicitly sets the flag.
    rosterSet.handicapLocked = data.handicapLocked ?? true;
  } else if (data.handicapLocked !== undefined) {
    rosterSet.handicapLocked = data.handicapLocked;
  }
  if (Object.keys(rosterSet).length > 0) {
    await db
      .update(seasonRosters)
      .set(rosterSet)
      .where(
        and(
          eq(seasonRosters.playerId, id),
          eq(
            seasonRosters.seasonId,
            sql`(SELECT ${seasons.id} FROM ${seasons} WHERE ${seasons.isCurrent} LIMIT 1)`,
          ),
        ),
      );
  }

  return row;
}

/** Per-player handicap-lock state for one season (for the admin editor). */
export async function listSeasonHandicapLocks(
  seasonId: number,
): Promise<Map<number, boolean>> {
  const rows = await db
    .select({
      playerId: seasonRosters.playerId,
      locked: seasonRosters.handicapLocked,
    })
    .from(seasonRosters)
    .where(eq(seasonRosters.seasonId, seasonId));
  return new Map(rows.map((r) => [r.playerId, r.locked]));
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
