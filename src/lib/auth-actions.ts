"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { admins, players } from "@/db/schema";
import { getSession } from "./session";
import { createSupabaseServerClient } from "./supabase/server";

const playerLoginSchema = z.object({
  playerId: z.coerce.number().int().positive(),
  pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
});

const adminLoginSchema = z.object({
  username: z.string().trim().min(1),
  code: z.string().min(1),
});

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function playerLogin(formData: FormData): Promise<AuthResult> {
  const parsed = playerLoginSchema.safeParse({
    playerId: formData.get("playerId"),
    pin: formData.get("pin"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, parsed.data.playerId))
    .limit(1);

  if (!player) return { ok: false, error: "Incorrect PIN" };

  const match = await bcrypt.compare(parsed.data.pin, player.pinHash);
  if (!match) return { ok: false, error: "Incorrect PIN" };

  const session = await getSession();
  session.kind = "player";
  session.playerId = player.id;
  delete session.adminId;
  await session.save();

  return { ok: true };
}

export async function adminLogin(formData: FormData): Promise<AuthResult> {
  const parsed = adminLoginSchema.safeParse({
    username: formData.get("username"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, parsed.data.username))
    .limit(1);

  if (!admin) return { ok: false, error: "Incorrect credentials" };

  const match = await bcrypt.compare(parsed.data.code, admin.codeHash);
  if (!match) return { ok: false, error: "Incorrect credentials" };

  const session = await getSession();
  session.kind = "admin";
  session.adminId = admin.id;
  delete session.playerId;
  await session.save();

  return { ok: true };
}

export async function logout() {
  // Clear any lingering Supabase auth cookies (defensive — iron-session is the
  // session of record, but a callback may have left Supabase cookies behind).
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // No Supabase session / cookies not writable here — safe to ignore.
  }

  const session = await getSession();
  session.destroy();
  redirect("/login");
}
