import { Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getDay2Leaderboard, getDay2Teams } from "@/lib/server/day2";
import { getCurrentUser } from "@/lib/session";
import { Day2ScoresForm } from "./scores-form";

export const metadata = { title: "Day 2 — Enter Score" };

export default async function Day2ScoresPage() {
  const [user, teams, lb] = await Promise.all([
    getCurrentUser(),
    getDay2Teams(),
    getDay2Leaderboard(),
  ]);

  if (!user) {
    return (
      <AppShell title="Day 2 — Enter Score" showBack backTo="/day2/leaderboard">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
          <Lock size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">Please log in to enter your Day 2 score.</p>
        </div>
      </AppShell>
    );
  }

  const isAdmin = user.kind === "admin";
  const userId = user.kind === "player" ? user.player.id : null;
  const myTeam = userId
    ? teams.find((t) => t.player1Id === userId || t.player2Id === userId)
    : null;

  if (user.kind === "player" && !myTeam && teams.length > 0) {
    return (
      <AppShell title="Day 2 — Enter Score" showBack backTo="/day2/leaderboard">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
          <Lock size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            You don&apos;t have a Day 2 team yet. Partner selection must complete first.
          </p>
        </div>
      </AppShell>
    );
  }

  const visibleTeams = isAdmin ? teams : myTeam ? [myTeam] : [];
  const lbByTeamId = new Map(lb.map((t) => [t.id, t]));

  return (
    <AppShell title="Day 2 — Enter Score" showBack backTo="/day2/leaderboard">
      <Day2ScoresForm
        teams={visibleTeams}
        roundsByTeam={Object.fromEntries(
          [...lbByTeamId.entries()].map(([id, t]) => [
            id,
            t.roundScores.map((r) => ({
              round: r.roundNumber,
              netScore: r.netScore,
            })),
          ]),
        )}
        userId={userId}
        isAdmin={isAdmin}
      />
    </AppShell>
  );
}
