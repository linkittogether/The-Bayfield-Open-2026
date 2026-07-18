"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { getSession } from "./session";
import { createSupabaseServerClient } from "./supabase/server";

// Login is Google SSO first (see src/app/auth/callback/route.ts). PIN login is a
// fallback for the handful of players without a Google account: they enter the
// 4-digit PIN an admin assigned them (PINs are set only in the admin player
// editor and are unique per player — players.pin has a unique constraint — so a
// PIN identifies exactly one player). Both paths set the same iron-session
// (playerId only); admin is always derived from players.isAdmin.

export type AuthResult = { ok: true } | { ok: false; error: string };

const playerLoginSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
});

export async function playerLogin(formData: FormData): Promise<AuthResult> {
  const parsed = playerLoginSchema.safeParse({ pin: formData.get("pin") });
  if (!parsed.success) return { ok: false, error: "Enter your 4-digit PIN" };

  // A PIN maps to exactly one player (unique column) — direct lookup.
  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.pin, parsed.data.pin))
    .limit(1);

  if (!player) return { ok: false, error: "Incorrect PIN" };

  const session = await getSession();
  session.playerId = player.id;
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
