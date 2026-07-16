import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { day2Teams, day3Matches, seasonRosters } from "@/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.kind !== "admin") throw new AuthError();
  return user;
}

export async function requireAdminOrSelf(
  playerId: number,
): Promise<CurrentUser & object> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  if (user.kind === "admin") return user;
  if (user.kind === "player" && user.player.id === playerId) return user;
  throw new AuthError();
}

export async function requireAdminOrTeamMember(teamId: number) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  if (user.kind === "admin") return user;
  const [team] = await db
    .select({ player1Id: day2Teams.player1Id, player2Id: day2Teams.player2Id })
    .from(day2Teams)
    .where(eq(day2Teams.id, teamId))
    .limit(1);
  if (
    user.kind === "player" &&
    team &&
    (team.player1Id === user.player.id || team.player2Id === user.player.id)
  ) {
    return user;
  }
  throw new AuthError();
}

/** Admin, or a player who is a captain on this season's roster (either team). */
export async function requireAdminOrCaptain(seasonId: number) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  if (user.kind === "admin") return user;
  if (user.kind === "player") {
    const [row] = await db
      .select({ id: seasonRosters.id })
      .from(seasonRosters)
      .where(
        and(
          eq(seasonRosters.seasonId, seasonId),
          eq(seasonRosters.playerId, user.player.id),
          eq(seasonRosters.isCaptain, true),
        ),
      )
      .limit(1);
    if (row) return user;
  }
  throw new AuthError();
}

export async function requireAdminOrMatchPlayer(matchId: number) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  if (user.kind === "admin") return user;
  const [match] = await db
    .select({
      truffle: day3Matches.trufflePlayerId,
      syndicate: day3Matches.syndicatePlayerId,
    })
    .from(day3Matches)
    .where(eq(day3Matches.id, matchId))
    .limit(1);
  if (
    user.kind === "player" &&
    match &&
    (match.truffle === user.player.id || match.syndicate === user.player.id)
  ) {
    return user;
  }
  throw new AuthError();
}
