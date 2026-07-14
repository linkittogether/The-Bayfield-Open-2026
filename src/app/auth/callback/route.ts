import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { admins, players } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Google OAuth return point. Supabase handled the Google handshake; here we
// exchange the code for a (short-lived) Supabase session purely to read the
// verified email, map it to an admin/player row, and set our own iron-session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const fail = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, origin));

  if (!code) return fail("oauth");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) return fail("oauth");

  const email = data.user.email.toLowerCase();

  // We only needed the identity — drop the Supabase session cookies.
  await supabase.auth.signOut();

  const [admin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(sql`lower(${admins.email})`, email))
    .limit(1);

  const session = await getSession();

  if (admin) {
    session.kind = "admin";
    session.adminId = admin.id;
    delete session.playerId;
    await session.save();
    return NextResponse.redirect(new URL("/", origin));
  }

  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(sql`lower(${players.email})`, email))
    .limit(1);

  if (player) {
    session.kind = "player";
    session.playerId = player.id;
    delete session.adminId;
    await session.save();
    return NextResponse.redirect(new URL("/", origin));
  }

  // Verified Google account, but nobody has been assigned this email.
  return fail("not-registered");
}
