import { eq } from "drizzle-orm";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { admins, players } from "@/db/schema";

export type SessionData = {
  kind?: "player" | "admin";
  playerId?: number;
  adminId?: number;
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

export type CurrentUser =
  | { kind: "player"; player: typeof players.$inferSelect }
  | { kind: "admin"; admin: typeof admins.$inferSelect }
  | null;

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await getSession();

  if (session.kind === "player" && session.playerId) {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, session.playerId))
      .limit(1);
    if (!player) {
      session.destroy();
      return null;
    }
    return { kind: "player", player };
  }

  if (session.kind === "admin" && session.adminId) {
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, session.adminId))
      .limit(1);
    if (!admin) {
      session.destroy();
      return null;
    }
    return { kind: "admin", admin };
  }

  return null;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.kind !== "admin") redirect("/login");
  return user.admin;
}

export async function requirePlayer() {
  const user = await getCurrentUser();
  if (user?.kind !== "player") redirect("/login");
  return user.player;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
