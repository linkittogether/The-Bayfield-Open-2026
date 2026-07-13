import Link from "next/link";
import { Flag, Settings, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDay3Leaderboard, getDay3Matches, getDay3Teams } from "@/lib/server/day3";
import { getTeamNetStandings } from "@/lib/server/scoring";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";
import { formatNet } from "@/lib/format";

export const metadata = { title: "Day 3 — Huron Cup" };

export default async function Day3LeaderboardPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const { viewed: season, readOnly } = await getSeasonView(yr);
  const [user, lb, matches, teams, teamNet] = await Promise.all([
    getCurrentUser(),
    getDay3Leaderboard(season.id),
    getDay3Matches(season.id),
    getDay3Teams(season.id),
    getTeamNetStandings(season.id),
  ]);
  const truffleNet = teamNet.find((t) => t.slug === "truffle_hogs");
  const syndicateNet = teamNet.find((t) => t.slug === "mycelium_syndicate");

  const isAdmin = user?.kind === "admin";
  const userId = user?.kind === "player" ? user.player.id : null;
  const allRoster = [...teams.truffleHogs, ...teams.myceliumSyndicate];
  const isCaptain = userId !== null && allRoster.some((p) => p.playerId === userId && p.isCaptain);
  const canSetupMatches = !readOnly && (isAdmin || isCaptain);

  const s = lb.summary;
  const trufflePts = s.trufflePoints;
  const syndicatePts = s.syndicatePoints;
  const truffleLeading = trufflePts > syndicatePts;
  const tie = trufflePts === syndicatePts;
  // Match-play matches close out early (before 18), so a completed Day 3 is the
  // season's day3Complete flag — not "every match reached 18 holes."
  const day3Done = matches.length > 0 && season.day3Complete;

  return (
    <AppShell title="Day 3 — Huron Cup" year={yr}>
      {canSetupMatches && (
        <div className="mb-5">
          <Button asChild className="w-full h-11">
            <Link href={`/${yr}/day3/setup`}>
              <Settings size={16} /> Setup Matches
            </Link>
          </Button>
        </div>
      )}

      <div className="bg-primary text-white rounded-2xl p-4 mb-5">
        <p className="text-green-200 text-xs text-center uppercase tracking-widest mb-3">
          Huron Cup
        </p>
        <div className="grid grid-cols-3 items-center text-center">
          <div className={cn(truffleLeading && "scale-110 transition-transform")}>
            <p className="text-2xl mb-1">🐗</p>
            <p className="text-xs text-green-200">Truffle Hogs</p>
            <p className="text-4xl font-bold">{trufflePts}</p>
            <p className="text-xs text-green-200">points</p>
          </div>
          <div>
            <p className="text-green-200 text-sm font-medium">vs</p>
            {tie && (trufflePts > 0 || syndicatePts > 0) && (
              <p className="text-xs text-green-300 mt-1">Tied!</p>
            )}
          </div>
          <div className={cn(!truffleLeading && !tie && "scale-110 transition-transform")}>
            <p className="text-2xl mb-1">🍄</p>
            <p className="text-xs text-green-200">Mycelium Syndicate</p>
            <p className="text-4xl font-bold">{syndicatePts}</p>
            <p className="text-xs text-green-200">points</p>
          </div>
        </div>
        <p className="text-center text-xs text-green-300 mt-2">
          {s.truffleMatchWins}–{s.syndicateMatchWins} in matches
          {s.tiedMatches > 0 &&
            `, ${s.tiedMatches} halved (½ each)`}
        </p>
      </div>

      {day3Done && (
        <div
          className={cn(
            "rounded-2xl p-5 text-center mb-5",
            truffleLeading
              ? "bg-truffle-light border border-truffle/30"
              : !tie
                ? "bg-syndicate-light border border-syndicate/30"
                : "bg-muted",
          )}
        >
          <Trophy size={36} className="mx-auto mb-2 text-gold" />
          <p className="font-bold text-2xl font-heading">
            {truffleLeading
              ? "🐗 Truffle Hogs Win!"
              : !tie
                ? "🍄 Mycelium Syndicate Wins!"
                : "It's a Draw!"}
          </p>
          <p className="text-sm mt-1 text-muted-foreground">Huron Cup Champions {season.year}</p>
        </div>
      )}

      {(truffleNet?.net != null || syndicateNet?.net != null) && (
        <div className="bg-white border border-border rounded-2xl p-4 mb-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider text-center">
            Team Net · nice-to-have
          </p>
          <p className="text-[11px] text-muted-foreground text-center mb-3">
            Combined stroke-play net — informational; the cup is decided by match play
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[truffleNet, syndicateNet].map((t, i) =>
              t ? (
                <div
                  key={t.slug}
                  className={cn(
                    "rounded-xl p-3 text-center",
                    i === 0 ? "bg-truffle-light" : "bg-syndicate-light",
                  )}
                >
                  <p className={cn("text-sm font-bold", i === 0 ? "text-truffle" : "text-syndicate")}>
                    {i === 0 ? "🐗" : "🍄"} {t.name}
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {t.net != null ? formatNet(t.net) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.scoredCount}/{t.playerCount} scored
                  </p>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="text-center py-10">
          <Flag size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold text-muted-foreground">No matches set up yet</p>
          {canSetupMatches && (
            <Link href={`/${yr}/day3/setup`} className="mt-3 inline-block text-sm text-primary underline">
              Set up matches →
            </Link>
          )}
        </div>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Matches
          </h3>
          <div className="flex flex-col gap-3">
            {matches.map((m) => {
              const done = m.status === "final";
              const halved = m.winner === "halved";
              const resultLabel = m.label || (done ? "Halved" : "—");
              const winnerEmoji = halved
                ? "🤝"
                : m.winner === "truffle"
                  ? "🐗"
                  : m.winner === "syndicate"
                    ? "🍄"
                    : "⛳";
              // list the leader/winner first (m.diff = truffle holes up)
              const level = m.diff === 0;
              const truffleFirst = m.diff >= 0;
              const th = m.truffleHolesWon;
              const sh = m.syndicateHolesWon;
              const first = truffleFirst
                ? { name: m.trufflePlayerName, color: "text-truffle" }
                : { name: m.syndicatePlayerName, color: "text-syndicate" };
              const second = truffleFirst
                ? { name: m.syndicatePlayerName, color: "text-syndicate" }
                : { name: m.trufflePlayerName, color: "text-truffle" };
              const sep = done && !level ? "def." : "vs";
              const isMyMatch =
                userId !== null && (m.trufflePlayerId === userId || m.syndicatePlayerId === userId);
              return (
                <Link key={m.id} href={`/${yr}/day3/match/${m.id}`}>
                  <div
                    className={cn(
                      "border rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform",
                      isMyMatch
                        ? "bg-primary/5 border-primary ring-2 ring-primary/30"
                        : "bg-white border-border",
                    )}
                  >
                    <div className="text-center w-7 flex-shrink-0">
                      <p className="text-lg leading-none">{winnerEmoji}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        M{m.matchNumber}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        <span className={cn(!level && `font-bold ${first.color}`)}>
                          {first.name}
                        </span>
                        <span className="text-muted-foreground mx-1">{sep}</span>
                        <span className="text-muted-foreground">{second.name}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isMyMatch && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-sm font-bold",
                          halved
                            ? "text-muted-foreground"
                            : th > sh
                              ? "text-truffle"
                              : "text-syndicate",
                        )}
                      >
                        {resultLabel}
                      </span>
                    </div>
                    {done && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        Done
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
