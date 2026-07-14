import { Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getDay2ScoreEntry } from "@/lib/server/day2";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";
import { BulkGrintPull } from "@/components/bulk-grint-pull";
import { Day2ScoresForm } from "./scores-form";

export const metadata = { title: "Day 2 — Enter Score" };
// Bulk Grint pull fans out network calls per player; give it headroom.
export const maxDuration = 60;

export default async function Day2ScoresPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const { viewed: season, readOnly } = await getSeasonView(yr);

  if (readOnly) {
    return (
      <AppShell title="Day 2 — Enter Score" showBack backTo={`/${yr}/day2/leaderboard`} year={yr}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          You&apos;re viewing the {season.year} season, which is read-only.
          Switch to the current season to enter scores.
        </div>
      </AppShell>
    );
  }

  const [user, entry] = await Promise.all([
    getCurrentUser(),
    getDay2ScoreEntry(season.id),
  ]);

  if (!user) {
    return (
      <AppShell title="Day 2 — Enter Score" showBack backTo={`/${yr}/day2/leaderboard`} year={yr}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
          <Lock size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">Please log in to enter your Day 2 score.</p>
        </div>
      </AppShell>
    );
  }

  const isAdmin = user.kind === "admin";
  const userId = user.kind === "player" ? user.player.id : null;

  return (
    <AppShell title="Day 2 — Enter Score" showBack backTo={`/${yr}/day2/leaderboard`} year={yr}>
      <p className="text-xs text-muted-foreground mb-4">
        Saturday is individual stroke play — enter your own gross for each round.
      </p>
      {isAdmin && (
        <div className="mb-5">
          <BulkGrintPull day={2} />
        </div>
      )}
      <Day2ScoresForm
        segments={entry.segments.map((s) => ({
          id: s.id,
          label: s.label,
          holes: s.holes,
          rating: s.rating,
          slope: s.slope,
          par: s.par,
        }))}
        players={entry.players}
        scores={entry.scores}
        userId={userId}
        isAdmin={isAdmin}
      />
    </AppShell>
  );
}
