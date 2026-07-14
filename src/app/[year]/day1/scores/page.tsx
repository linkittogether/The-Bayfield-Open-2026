import Link from "next/link";
import { LogIn } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getDay1ScoreEntry, getDay1Scores } from "@/lib/server/day1";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";
import { BulkGrintPull } from "@/components/bulk-grint-pull";
import { ScoresForm } from "./scores-form";

export const metadata = { title: "Day 1 — Enter Score" };
// Bulk Grint pull fans out network calls per player; give it headroom.
export const maxDuration = 60;

export default async function Day1ScoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ pull?: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const { pull } = await searchParams;
  const { viewed: season, readOnly } = await getSeasonView(yr);
  const user = await getCurrentUser();

  if (readOnly) {
    return (
      <AppShell title="Day 1 — Enter Score" showBack backTo={`/${yr}/day1/leaderboard`} year={yr}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          You&apos;re viewing the {season.year} season, which is read-only.
          Switch to the current season to enter scores.
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Day 1 — Enter Score" showBack backTo={`/${yr}/day1/leaderboard`} year={yr}>
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

  const [entry, scores] = await Promise.all([
    getDay1ScoreEntry(season.id),
    getDay1Scores(season.id),
  ]);
  const submittedIds = scores.map((s) => s.playerId);
  const lockedPlayerId = user.kind === "player" ? user.player.id : null;
  const isAdmin = user.kind === "admin";

  return (
    <AppShell title="Day 1 — Enter Score" showBack backTo={`/${yr}/day1/leaderboard`} year={yr}>
      {isAdmin && (
        <div className="mb-5">
          <BulkGrintPull day={1} />
        </div>
      )}
      <ScoresForm
        players={entry.players}
        segment={entry.segment}
        submittedIds={submittedIds}
        lockedPlayerId={lockedPlayerId}
        isAdmin={isAdmin}
        autoPull={pull === "1"}
      />
    </AppShell>
  );
}
