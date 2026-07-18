import { Fragment } from "react";
import Link from "next/link";
import { ClipboardList, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { BulkGrintPull } from "@/components/bulk-grint-pull";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";
import { formatNet, ordinal } from "@/lib/format";
import { getDay2Leaderboard } from "@/lib/server/day2";
import { getSeasonState } from "@/lib/server/tournament";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Day 2 Leaderboard" };
// The admin bulk Grint pull runs from this route; give it headroom.
export const maxDuration = 60;

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
  const isAdmin = user?.kind === "admin";
  // Champions are only crowned once an admin closes Day 2 scoring. Before that
  // (even with every score in) the top pair is shown as the provisional leader.
  const champions = !!state?.day2Complete;
  // Surface the leader as soon as any pair has a combined net.
  const leader = lb[0]?.combinedNet != null ? lb[0] : null;
  // Does the current person already have all their Day-2 grosses in? → "Edit".
  const meId = user?.player.id ?? null;
  const myEntry =
    meId != null
      ? lb.find((e) => e.player1Id === meId || e.player2Id === meId)
      : null;
  const myGrosses = myEntry
    ? myEntry.player1Id === meId
      ? myEntry.player1Day2Grosses
      : myEntry.player2Day2Grosses
    : null;
  const iScored =
    !!myGrosses && myGrosses.length > 0 && myGrosses.every((g) => g != null);

  return (
    <AppShell title="Day 2 Leaderboard" year={yr}>
      {leader && (
        <div className="mb-5 bg-primary text-white rounded-2xl p-5 text-center">
          <Trophy size={36} className="mx-auto mb-2 text-gold" />
          <p className="font-bold text-xl font-heading">
            {champions ? "Pairs Champions!" : "Current Leader"}
          </p>
          <p className="text-green-200 text-sm mt-1">
            {leader.player1Name} & {leader.player2Name} with {formatNet(leader.combinedNet)} net
          </p>
          {!champions && (
            <p className="text-green-200/80 text-xs mt-1">
              Provisional — final once Day 2 scoring is closed
            </p>
          )}
          {champions && !readOnly && !state?.day2DraftComplete && (
            <Link
              href={`/${yr}/day2/draft`}
              className="mt-4 w-full h-11 rounded-lg bg-white text-primary font-semibold flex items-center justify-center hover:bg-white/90 active:scale-95 transition-colors"
            >
              Proceed to Day 3 Draft
            </Link>
          )}
        </div>
      )}

      {/* Score entry is hidden once Day 2 scoring is closed. */}
      {!readOnly && !champions && (
        <div className="mb-5">
          <Button asChild className="w-full h-11">
            <Link href={`/${yr}/day2/scores`}>
              <ClipboardList size={16} /> {iScored ? "Edit Score" : "Enter Score"}
            </Link>
          </Button>
        </div>
      )}

      {!readOnly && isAdmin && (
        <div className="mb-5">
          <BulkGrintPull day={2} />
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
            const playerRows = [
              {
                name: entry.player1Name,
                total: { gross: entry.player1TotalGross, net: entry.player1Net },
                rounds: [
                  { gross: entry.player1Day1Gross, net: entry.player1Day1Net },
                  ...entry.player1Day2Grosses.map((gross, k) => ({
                    gross,
                    net: entry.player1Day2Nets[k],
                  })),
                ],
              },
              {
                name: entry.player2Name,
                total: { gross: entry.player2TotalGross, net: entry.player2Net },
                rounds: [
                  { gross: entry.player2Day1Gross, net: entry.player2Day1Net },
                  ...entry.player2Day2Grosses.map((gross, k) => ({
                    gross,
                    net: entry.player2Day2Nets[k],
                  })),
                ],
              },
            ];
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

                <div className="border-t border-border px-3 py-2 overflow-x-auto">
                  <div
                    className="grid gap-x-2 gap-y-1.5 items-center text-xs min-w-max"
                    style={{
                      gridTemplateColumns: `minmax(4rem,1fr) repeat(${entry.day2SegLabels.length + 2}, 2.75rem)`,
                    }}
                  >
                    <span className="text-[9px] text-muted-foreground normal-case">
                      gross / <span className="italic">net</span>
                    </span>
                    <span className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">Day 1</span>
                    {entry.day2SegLabels.map((lbl, k) => (
                      <span key={`h${k}`} className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                        {lbl}
                      </span>
                    ))}
                    <span className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>

                    {playerRows.map((pl) => (
                      <Fragment key={pl.name}>
                        <span className="font-medium truncate">{pl.name}</span>
                        {pl.rounds.map((r, k) => (
                          <span key={k} className="text-center leading-tight">
                            <span className="block font-semibold">{r.gross ?? "—"}</span>
                            <span className="block text-[10px] italic text-muted-foreground">
                              {formatNet(r.net)}
                            </span>
                          </span>
                        ))}
                        <span className="text-center leading-tight">
                          <span className="block font-semibold">{pl.total.gross ?? "—"}</span>
                          <span className="block text-[10px] italic text-muted-foreground">
                            {formatNet(pl.total.net)}
                          </span>
                        </span>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </AppShell>
  );
}
