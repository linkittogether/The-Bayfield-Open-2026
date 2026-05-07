import Link from "next/link";
import { LogIn } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { listPlayers } from "@/lib/server/players";
import { getDay1Scores } from "@/lib/server/day1";
import { getCurrentUser } from "@/lib/session";
import { ScoresForm } from "./scores-form";

export const metadata = { title: "Day 1 — Enter Score" };

export default async function Day1ScoresPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AppShell title="Day 1 — Enter Score" showBack backTo="/day1/leaderboard">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <p className="font-semibold text-lg">Login Required</p>
          <p className="text-sm text-muted-foreground">
            You need to log in to enter your score.
          </p>
          <Button asChild className="h-11">
            <Link href="/login">
              <LogIn size={18} /> Log In
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const [players, scores] = await Promise.all([listPlayers(), getDay1Scores()]);
  const submittedIds = scores.map((s) => s.playerId);
  const lockedPlayerId = user.kind === "player" ? user.player.id : null;
  const isAdmin = user.kind === "admin";

  return (
    <AppShell title="Day 1 — Enter Score" showBack backTo="/day1/leaderboard">
      <ScoresForm
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          photoUrl: p.photoUrl,
          handicap: p.handicap,
        }))}
        submittedIds={submittedIds}
        lockedPlayerId={lockedPlayerId}
        isAdmin={isAdmin}
      />
    </AppShell>
  );
}
