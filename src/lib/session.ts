import { eq } from "drizzle-orm";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { db } from "@/db";
import { players } from "@/db/schema";

// The session only stores the player id. Whether they're an admin is derived
// from players.isAdmin on read — a single source of truth (no separate admins).
export type SessionData = {
  playerId?: number;
};

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "bayfield_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

// Everyone is a player; `kind` is derived from players.isAdmin. Kept as a
// discriminant so existing `user.kind === "admin"` checks keep working.
export type CurrentUser = {
  kind: "admin" | "player";
  player: typeof players.$inferSelect;
} | null;

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (!session.playerId) return null;

  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, session.playerId))
    .limit(1);
  if (!player) {
    session.destroy();
    return null;
  }
  return { kind: player.isAdmin ? "admin" : "player", player };
}
