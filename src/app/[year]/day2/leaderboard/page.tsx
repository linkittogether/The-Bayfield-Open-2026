import Link from "next/link";
import { ClipboardList, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";
import { formatNet, ordinal } from "@/lib/format";
import { getDay2Leaderboard } from "@/lib/server/day2";
import { getSeasonState } from "@/lib/server/tournament";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Day 2 Leaderboard" };

const medals = ["🥇", "🥈", "🥉"];

export default async function Day2LeaderboardPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const { viewed: season, readOnly } = await getSeasonView(yr);
  const [user, lb, state] = await Promise.all([
    getCurrentUser(),
    getDay2Leaderboard(season.id),
    getSeasonState(season.id),
  ]);

  const userId = user?.kind === "player" ? user.player.id : null;
  const allDone = lb.length > 0 && lb.every((e) => e.combinedNet != null);

  return (
    <AppShell title="Day 2 Leaderboard" year={yr}>
      {!readOnly && (
        <div className="mb-5">
          <Button asChild className="w-full h-11">
            <Link href={`/${yr}/day2/scores`}>
              <ClipboardList size={16} /> Enter Score
            </Link>
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-3">
        Pairs ranked by combined net (Friday + Saturday, both partners).
      </p>

      {lb.length === 0 ? (
        <div className="bg-muted rounded-2xl p-8 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold text-muted-foreground">No pairs yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Complete Day 1 partner selection first
          </p>
          <Link href={`/${yr}/day1/picks`} className="mt-3 inline-block text-sm text-primary underline">
            Go to partner selection →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {lb.map((entry, i) => {
            const isMe =
              userId !== null &&
              (entry.player1Id === userId || entry.player2Id === userId);
            return (
              <div
                key={entry.id}
                className={cn(
                  "rounded-xl border overflow-hidden",
                  isMe
                    ? "bg-primary/5 border-primary ring-2 ring-primary/30"
                    : i === 0 && entry.combinedNet != null
                      ? "bg-white border-gold ring-1 ring-gold/50"
                      : "bg-white border-border",
                )}
              >
                <div className="p-3 flex items-center gap-3">
                  <div className="w-8 text-center font-bold text-sm">
                    {entry.combinedNet != null ? medals[i] || ordinal(i + 1) : "—"}
                  </div>
                  <div className="flex -space-x-2 flex-shrink-0">
                    <PlayerAvatar name={entry.player1Name} photoUrl={entry.player1Photo} size="sm" />
                    <PlayerAvatar name={entry.player2Name} photoUrl={entry.player2Photo} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {entry.player1Name} & {entry.player2Name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Index {entry.player1Handicap}/{entry.player2Handicap}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isMe && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                    <div className="text-right">
                      <p className="font-bold text-xl leading-none">
                        {formatNet(entry.combinedNet)}
                      </p>
                      <p className="text-xs text-muted-foreground">net</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border px-3 py-2 grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground truncate">{entry.player1Name}</p>
                    <p className="text-sm font-semibold">{formatNet(entry.player1Net)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground truncate">{entry.player2Name}</p>
                    <p className="text-sm font-semibold">{formatNet(entry.player2Net)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allDone && (
        <div className="mt-5 bg-primary text-white rounded-2xl p-5 text-center">
          <Trophy size={36} className="mx-auto mb-2 text-gold" />
          <p className="font-bold text-xl font-heading">Pairs Champions!</p>
          <p className="text-green-200 text-sm mt-1">
            {lb[0].player1Name} & {lb[0].player2Name} with {formatNet(lb[0].combinedNet)} net
          </p>
          {!readOnly && !state?.day2DraftComplete && (
            <Button
              asChild
              className="mt-4 bg-white text-primary hover:bg-white/90 w-full"
            >
              <Link href={`/${yr}/day2/draft`}>Proceed to Day 3 Draft</Link>
            </Button>
          )}
        </div>
      )}
    </AppShell>
  );
}
