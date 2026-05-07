import { AppShell } from "@/components/app-shell";
import { getDay3Match } from "@/lib/server/day3";
import { getCurrentUser } from "@/lib/session";
import { MatchScoreboard } from "./match-scoreboard";

export const metadata = { title: "Match Scoring" };

export default async function Day3MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);

  const [user, match] = await Promise.all([
    getCurrentUser(),
    Number.isFinite(matchId) ? getDay3Match(matchId) : Promise.resolve(null),
  ]);

  if (!match) {
    return (
      <AppShell title="Match Not Found" showBack backTo="/day3/leaderboard">
        <p className="text-center text-muted-foreground py-10">Match not found</p>
      </AppShell>
    );
  }

  const isAdmin = user?.kind === "admin";
  const userId = user?.kind === "player" ? user.player.id : null;
  const canScore =
    isAdmin ||
    (userId !== null &&
      (match.trufflePlayerId === userId || match.syndicatePlayerId === userId));

  return (
    <AppShell title={`Match ${match.matchNumber}`} showBack backTo="/day3/leaderboard">
      <MatchScoreboard match={match} canScore={canScore} />
    </AppShell>
  );
}
