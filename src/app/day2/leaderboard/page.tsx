import Link from "next/link";
import { ClipboardList, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";
import { ordinal } from "@/lib/format";
import { getDay2Leaderboard } from "@/lib/server/day2";
import { getSeasonState } from "@/lib/server/tournament";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Day 2 Leaderboard" };

const medals = ["🥇", "🥈", "🥉"];

export default async function Day2LeaderboardPage() {
  const { viewed: season, readOnly } = await getSeasonView();
  const [user, lb, state] = await Promise.all([
    getCurrentUser(),
    getDay2Leaderboard(season.id),
    getSeasonState(season.id),
  ]);

  const userId = user?.kind === "player" ? user.player.id : null;
  const allDone = lb.length > 0 && lb.every((e) => e.roundsComplete >= 3);

  return (
    <AppShell title="Day 2 Leaderboard">
      {!readOnly && (
        <div className="mb-5">
          <Button asChild className="w-full h-11">
            <Link href="/day2/scores">
              <ClipboardList size={16} /> Enter Score
            </Link>
          </Button>
        </div>
      )}

      {lb.length === 0 ? (
        <div className="bg-muted rounded-2xl p-8 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold text-muted-foreground">No teams yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Complete Day 1 partner selection first
          </p>
          <Link href="/day1/picks" className="mt-3 inline-block text-sm text-primary underline">
            Go to partner selection →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {lb.map((entry, i) => {
            const isMe =
              userId !== null &&
              (entry.player1Id === userId || entry.player2Id === userId);
            const rounds = entry.roundScores;
            return (
              <div
                key={entry.id}
                className={cn(
                  "rounded-xl border overflow-hidden",
                  isMe
                    ? "bg-primary/5 border-primary ring-2 ring-primary/30"
                    : i === 0
                      ? "bg-white border-gold ring-1 ring-gold/50"
                      : i === 1
                        ? "bg-white border-gray-300"
                        : "bg-white border-border",
                )}
              >
                <div className="p-3 flex items-center gap-3">
                  <div className="w-8 text-center font-bold text-sm">
                    {medals[i] || ordinal(i + 1)}
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
                      {entry.roundsComplete}/3 rounds · HCP {entry.player1Handicap}/{entry.player2Handicap}
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
                        {entry.totalNetScore || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">net</p>
                    </div>
                  </div>
                </div>

                {rounds.length > 0 && (
                  <div className="border-t border-border px-3 py-2 grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((r) => {
                      const rs = rounds.find((x) => x.roundNumber === r);
                      return (
                        <div key={r} className="text-center">
                          <p className="text-xs text-muted-foreground">R{r}</p>
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              rs ? "text-foreground" : "text-border",
                            )}
                          >
                            {rs ? rs.netScore : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {allDone && (
        <div className="mt-5 bg-primary text-white rounded-2xl p-5 text-center">
          <Trophy size={36} className="mx-auto mb-2 text-gold" />
          <p className="font-bold text-xl font-heading">Bayfield Open Champions!</p>
          <p className="text-green-200 text-sm mt-1">
            {lb[0].player1Name} & {lb[0].player2Name} with {lb[0].totalNetScore} net
          </p>
          {!readOnly && !state?.day2DraftComplete && (
            <Button
              asChild
              className="mt-4 bg-white text-primary hover:bg-white/90 w-full"
            >
              <Link href="/day2/draft">Proceed to Day 3 Draft</Link>
            </Button>
          )}
        </div>
      )}
    </AppShell>
  );
}
