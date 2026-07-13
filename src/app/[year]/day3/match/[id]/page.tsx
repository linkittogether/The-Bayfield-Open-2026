import { AppShell } from "@/components/app-shell";
import { getDay3Match } from "@/lib/server/day3";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";
import { MatchScoreboard } from "./match-scoreboard";

export const metadata = { title: "Match Scoring" };

export default async function Day3MatchPage({
  params,
}: {
  params: Promise<{ id: string; year: string }>;
}) {
  const { id, year } = await params;
  const matchId = Number(id);
  const yr = Number(year);

  const [{ readOnly }, user, match] = await Promise.all([
    getSeasonView(yr),
    getCurrentUser(),
    Number.isFinite(matchId) ? getDay3Match(matchId) : Promise.resolve(null),
  ]);

  if (!match) {
    return (
      <AppShell title="Match Not Found" showBack backTo={`/${yr}/day3/leaderboard`} year={yr}>
        <p className="text-center text-muted-foreground py-10">Match not found</p>
      </AppShell>
    );
  }

  const isAdmin = user?.kind === "admin";
  const userId = user?.kind === "player" ? user.player.id : null;
  const canScore =
    !readOnly &&
    (isAdmin ||
      (userId !== null &&
        (match.trufflePlayerId === userId || match.syndicatePlayerId === userId)));

  return (
    <AppShell title={`Match ${match.matchNumber}`} showBack backTo={`/${yr}/day3/leaderboard`} year={yr}>
      <MatchScoreboard match={match} canScore={canScore} />
    </AppShell>
  );
}
