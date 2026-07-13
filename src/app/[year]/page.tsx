import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, Flag, Settings, Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { formatNet } from "@/lib/format";
import { listPlayers } from "@/lib/server/players";
import { getDay1Leaderboard, getDay1PicksOverview } from "@/lib/server/day1";
import { getDay3Matches } from "@/lib/server/day3";
import { getSeasonState } from "@/lib/server/tournament";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const { viewed: season, readOnly } = await getSeasonView(yr);
  const [user, state, playerList, day1Lb, picks, matches] = await Promise.all([
    getCurrentUser(),
    getSeasonState(season.id),
    listPlayers(),
    getDay1Leaderboard(season.id),
    getDay1PicksOverview(season.id),
    getDay3Matches(season.id),
  ]);

  const isAdmin = user?.kind === "admin";
  const userId = user?.kind === "player" ? user.player.id : null;
  const nextStep = readOnly
    ? null
    : computeNextStep({ state, userId, isAdmin, day1Lb, picks, matches });
  if (nextStep) nextStep.href = `/${yr}${nextStep.href}`;

  return (
    <AppShell year={yr}>
      <div className="rounded-2xl overflow-hidden mb-5 bg-primary text-white p-5 pb-6">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Bayfield Open"
            width={96}
            height={96}
            className="h-24 w-24 object-contain mb-3"
            style={{ filter: "invert(1)" }}
            priority
          />
          <p className="text-green-200 text-xs font-medium mb-1 uppercase tracking-widest">
            {season.year} Tournament
          </p>
          <h2 className="text-3xl font-bold mb-1 font-heading">The Bayfield Open</h2>
          <p className="text-green-100 text-sm">
            {playerList.length} players · 3 days · All The Mushrooms
          </p>
        </div>
      </div>

      {nextStep && (
        <Link href={nextStep.href}>
          <div
            className={cn(
              "rounded-2xl p-4 mb-5 flex items-center gap-4 active:scale-[0.98] transition-transform border-2",
              nextStep.urgent
                ? "bg-primary text-white border-primary"
                : "bg-accent border-secondary/40",
            )}
          >
            <div
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xl",
                nextStep.urgent ? "bg-white/20" : "bg-secondary/15",
              )}
            >
              {nextStep.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest mb-0.5",
                  nextStep.urgent ? "text-green-200" : "text-secondary",
                )}
              >
                Your next step
              </p>
              <p
                className={cn(
                  "font-bold text-base leading-snug",
                  nextStep.urgent ? "text-white" : "text-foreground",
                )}
              >
                {nextStep.label}
              </p>
              {nextStep.sub && (
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    nextStep.urgent ? "text-green-200" : "text-muted-foreground",
                  )}
                >
                  {nextStep.sub}
                </p>
              )}
            </div>
            <ArrowRight size={20} className={nextStep.urgent ? "text-white/80" : "text-muted-foreground"} />
          </div>
        </Link>
      )}

      <div className="space-y-3 mb-5">
        <DayCard day={1} title="Day 1 — Just You" subtitle="9 holes · Handicap scoring · Partner pick" complete={state?.day1Complete} href={`/${yr}/day1/leaderboard`} icon={<Trophy size={22} className="text-gold" />} />
        <DayCard day={2} title="Day 2 — Partner Up" subtitle="27 holes · Combined net score" complete={state?.day2Complete} href={`/${yr}/day2/leaderboard`} icon={<Users size={22} className="text-gold" />} />
        <DayCard day={3} title="Day 3 — 10 v 10" subtitle="Truffle Hogs vs Mycelium Syndicate · Huron Cup" complete={state?.day3Complete} href={`/${yr}/day3/leaderboard`} icon={<Flag size={22} className="text-gold" />} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link href={`/${yr}/day2/draft`}>
          <div className="bg-truffle-light rounded-xl p-3 text-center active:scale-[0.97] transition-transform">
            <p className="text-xl mb-1">🐗</p>
            <p className="text-xs font-bold text-truffle leading-tight">The Truffle Hogs</p>
          </div>
        </Link>
        <Link href={`/${yr}/day2/draft`}>
          <div className="bg-syndicate-light rounded-xl p-3 text-center active:scale-[0.97] transition-transform">
            <p className="text-xl mb-1">🍄</p>
            <p className="text-xs font-bold text-syndicate leading-tight">Mycelium Syndicate</p>
          </div>
        </Link>
      </div>

      {isAdmin && (
        <Link href={`/${yr}/admin`}>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-white active:scale-[0.98] transition-transform">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Settings size={16} className="text-primary" />
            </div>
            <span className="flex-1 text-sm font-medium">Admin Panel</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </Link>
      )}
    </AppShell>
  );
}

function DayCard({
  day,
  title,
  subtitle,
  complete,
  href,
  icon,
}: {
  day: number;
  title: string;
  subtitle: string;
  complete?: boolean;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "bg-white rounded-xl p-4 border flex items-center gap-4 transition-all active:scale-[0.98]",
          complete ? "border-primary" : "border-border",
        )}
      >
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0",
            complete ? "bg-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {complete ? icon : day}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
      </div>
    </Link>
  );
}

type NextStep = {
  label: string;
  sub?: string;
  href: string;
  emoji: string;
  urgent: boolean;
};

function computeNextStep(args: {
  state: Awaited<ReturnType<typeof getSeasonState>>;
  userId: number | null;
  isAdmin: boolean;
  day1Lb: Awaited<ReturnType<typeof getDay1Leaderboard>>;
  picks: Awaited<ReturnType<typeof getDay1PicksOverview>>;
  matches: Awaited<ReturnType<typeof getDay3Matches>>;
}): NextStep | null {
  const { state, userId, isAdmin, day1Lb, picks, matches } = args;
  if (!state) return null;

  if (!state.day3Complete && (state.day2Complete || state.day2DraftComplete)) {
    if (matches && matches.length > 0 && userId) {
      const myMatch = matches.find(
        (m) => m.trufflePlayerId === userId || m.syndicatePlayerId === userId,
      );
      if (myMatch) {
        const myHoles = myMatch.truffleHolesWon + myMatch.syndicateHolesWon + myMatch.tiedHoles;
        const done = myHoles >= 18;
        const opponent =
          myMatch.trufflePlayerId === userId
            ? myMatch.syndicatePlayerName
            : myMatch.trufflePlayerName;
        return {
          label: done ? "See the Huron Cup results" : "Score your match",
          sub: done
            ? "Your match is complete — check the leaderboard"
            : `vs. ${opponent} · Hole ${myHoles + 1} of 18`,
          href: done ? "/day3/leaderboard" : `/day3/match/${myMatch.id}`,
          emoji: "⛳",
          urgent: !done,
        };
      }
    }
    return {
      label: "Check the Huron Cup",
      sub: "Day 3 match play is underway",
      href: "/day3/leaderboard",
      emoji: "🏆",
      urgent: false,
    };
  }

  if (state.day3Complete) {
    return {
      label: "See who won the Huron Cup",
      sub: "Tournament complete — final results are in!",
      href: "/day3/leaderboard",
      emoji: "🏆",
      urgent: false,
    };
  }

  if (state.day1PickingComplete && !state.day2Complete && !state.day2DraftComplete) {
    if (userId) {
      return {
        label: "Enter your Day 2 score",
        sub: "27 holes · 3 rounds with your partner",
        href: "/day2/scores",
        emoji: "🤝",
        urgent: true,
      };
    }
    return {
      label: "View Day 2 leaderboard",
      sub: "Partner play is underway",
      href: "/day2/leaderboard",
      emoji: "🤝",
      urgent: false,
    };
  }

  if (!state.day1PickingComplete) {
    const nextPicker = picks?.nextPicker;
    if (nextPicker) {
      const isMyTurn = userId !== null && nextPicker.id === userId;
      if (isMyTurn || isAdmin) {
        return {
          label: isAdmin ? `${nextPicker.name} is picking a partner` : "Pick your partner!",
          sub: isAdmin
            ? "Head to partner selection to record their pick"
            : "It's your turn — choose your Day 2 partner",
          href: "/day1/picks",
          emoji: "🤜",
          urgent: true,
        };
      }
      return {
        label: "Partner selection in progress",
        sub: `Waiting for ${nextPicker.name} to pick`,
        href: "/day1/picks",
        emoji: "🤜",
        urgent: false,
      };
    }
  }

  if (!state.day1Complete) {
    if (userId) {
      const hasScored = day1Lb.find((e) => e.id === userId);
      return {
        label: hasScored ? "View Day 1 leaderboard" : "Enter your Day 1 score",
        sub: hasScored
          ? `Your net score: ${formatNet(hasScored.netScore)} · Rank #${hasScored.rank}`
          : "9 holes · Your gross score goes in here",
        href: hasScored ? "/day1/leaderboard" : "/day1/scores",
        emoji: "🏌️",
        urgent: !hasScored,
      };
    }
    return {
      label: "View Day 1 leaderboard",
      sub: "Scores are being entered",
      href: "/day1/leaderboard",
      emoji: "🏌️",
      urgent: false,
    };
  }

  return null;
}
