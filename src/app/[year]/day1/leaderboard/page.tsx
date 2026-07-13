import Link from "next/link";
import { ClipboardList, Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";
import { formatNet, ordinal } from "@/lib/format";
import { getDay1Leaderboard } from "@/lib/server/day1";
import { listPlayers } from "@/lib/server/players";
import { getSeasonState } from "@/lib/server/tournament";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Day 1 Leaderboard" };

const medals = ["🥇", "🥈", "🥉"];

export default async function Day1LeaderboardPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const { viewed: season, readOnly } = await getSeasonView(yr);
  const [user, lb, players, state] = await Promise.all([
    getCurrentUser(),
    getDay1Leaderboard(season.id),
    listPlayers(),
    getSeasonState(season.id),
  ]);

  const userId = user?.kind === "player" ? user.player.id : null;
  const scoredIds = new Set(lb.map((e) => e.id));
  const notScored = players.filter((p) => !scoredIds.has(p.id));

  return (
    <AppShell title="Day 1 Leaderboard" year={yr}>
      {!readOnly && (
        <div className="mb-5">
          <Button asChild className="w-full h-11">
            <Link href={`/${yr}/day1/scores`}>
              <ClipboardList size={16} /> Enter Score
            </Link>
          </Button>
        </div>
      )}

      {lb.length === 0 ? (
        <div className="bg-muted rounded-2xl p-8 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold text-muted-foreground">No scores yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Register players and enter scores to see the leaderboard
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lb.map((entry, i) => {
            const isMe = userId === entry.id;
            return (
              <div
                key={entry.id}
                className={cn(
                  "rounded-xl border flex items-center gap-3 p-3 transition-all",
                  isMe
                    ? "bg-primary/10 border-primary ring-2 ring-primary/30"
                    : i < 3
                      ? "bg-white border-primary/30"
                      : i === 9
                        ? "bg-white border-secondary ring-1 ring-secondary"
                        : "bg-white border-border",
                )}
              >
                <div className="w-8 text-center font-bold text-sm text-muted-foreground">
                  {medals[i] || ordinal(i + 1)}
                </div>
                <PlayerAvatar name={entry.name} photoUrl={entry.photoUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    HCP {entry.handicap} · Gross {entry.grossScore}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg leading-none">{formatNet(entry.netScore)}</p>
                  <p className="text-xs text-muted-foreground">net</p>
                </div>
                {isMe && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                    You
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {notScored.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Awaiting Score ({notScored.length})
          </h3>
          <div className="space-y-2">
            {notScored.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-dashed border-border flex items-center gap-3 p-3"
              >
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                <p className="text-sm text-muted-foreground truncate flex-1">{p.name}</p>
                <p className="text-xs text-muted-foreground">HCP {p.handicap}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!readOnly && lb.length >= 20 && !state?.day1PickingComplete && (
        <div className="mt-5 bg-accent rounded-2xl p-4 border border-secondary/30">
          <p className="font-semibold text-sm mb-1">Ready to pick partners!</p>
          <p className="text-xs text-muted-foreground mb-3">
            All 20 players have scores. Start the Day 2 partner selection.
          </p>
          <Button asChild className="w-full bg-secondary text-white hover:bg-secondary/90">
            <Link href={`/${yr}/day1/picks`}>
              <Users size={16} /> Start Partner Pick
            </Link>
          </Button>
        </div>
      )}

      {state?.day1PickingComplete && (
        <div className="mt-5 bg-green-50 rounded-2xl p-4 border border-green-200">
          <p className="font-semibold text-sm text-green-800 mb-1">Partners selected ✓</p>
          <Link href={`/${yr}/day1/picks`} className="text-sm text-green-700 underline">
            View pairings →
          </Link>
        </div>
      )}
    </AppShell>
  );
}
