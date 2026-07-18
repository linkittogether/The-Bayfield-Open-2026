import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Flag, Settings, Shield, Trophy, Users } from "lucide-react";
import { AdminCompleteButton } from "@/components/admin-complete-button";
import { AppShell } from "@/components/app-shell";
import { CloseDay1Button } from "@/components/close-day1-button";
import { LockDraftButton } from "@/components/lock-draft-button";
import { cn } from "@/lib/utils";
import { formatNet } from "@/lib/format";
import { getActiveRoster } from "@/lib/server/players";
import { getDay1Leaderboard, getDay1PicksOverview } from "@/lib/server/day1";
import {
  completeDay2,
  completeDay2Draft,
  getDay2Leaderboard,
} from "@/lib/server/day2";
import {
  completeDay3,
  getDay3Leaderboard,
  getDay3Matches,
} from "@/lib/server/day3";
import { getCourseNamesByDay } from "@/lib/server/courses";
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
  const [user, state, playerList, day1Lb, picks, matches, day2Lb, day3Lb, courseNames] =
    await Promise.all([
      getCurrentUser(),
      getSeasonState(season.id),
      getActiveRoster(season.id),
      getDay1Leaderboard(season.id),
      getDay1PicksOverview(season.id),
      getDay3Matches(season.id),
      getDay2Leaderboard(season.id),
      getDay3Leaderboard(season.id),
      getCourseNamesByDay(season.id),
    ]);
  // Prefer the season's course name for each day's card; fall back to the
  // format descriptor if a day has no course configured yet.
  const dayLabel = (day: number, fallback: string) =>
    courseNames.get(day) ?? fallback;

  const isAdmin = user?.kind === "admin";
  const userId = user?.kind === "player" ? user.player.id : null;
  // All Day-2 stroke rounds scored for every pair → the Day 3 team draft opens.
  const day2AllScored = day2Lb.length > 0 && day2Lb.every((e) => e.complete);
  // Once the season is complete, the stage stack is replaced by the two trophies.
  const seasonComplete = !!state?.day3Complete;
  const pairsChamp = day2Lb[0] ?? null;
  const hc = day3Lb.summary;
  const huronTie = hc.trufflePoints === hc.syndicatePoints;
  const truffleWonCup = hc.trufflePoints > hc.syndicatePoints;

  // Per-stage "ready to close out" gates — a stage's admin completion button only
  // appears once that stage can actually be completed, not merely "not yet done".
  // (Day 1 close + partner-draft lock live in the "next step" tile, not card buttons.)
  // Match Play Draft is "ready to finalize" only once the Sunday matchups have
  // actually been drafted (day3Matches saved) — team rosters are pre-assigned, so
  // roster assignment alone doesn't mean the draft happened.
  const matchDraftReady = matches.length > 0;
  // Day 3: every match has been decided (match play closes out before 18 holes).
  const day3AllDecided =
    matches.length > 0 && matches.every((m) => m.status === "final");
  const nextStep = readOnly
    ? null
    : computeNextStep({
        state,
        userId,
        isAdmin,
        day1Lb,
        picks,
        matches,
        rosterCount: playerList.length,
        day2AllScored,
        matchDraftReady,
        day3AllDecided,
      });
  if (nextStep) {
    nextStep.href = `/${yr}${nextStep.href}`;
    if (nextStep.actions) {
      nextStep.actions = nextStep.actions.map((a) => ({
        ...a,
        href: `/${yr}${a.href}`,
      }));
    }
  }
  // Player "your turn" tiles are solid green; admin action tiles use the calmer
  // cream/accent look (like the Grint pull tiles) with a solid green button.
  const tileGreen = !!nextStep?.urgent && nextStep?.audience !== "admin";
  const stepEyebrow =
    nextStep?.audience === "admin" ? (
      <span className="inline-flex items-center gap-1">
        <Shield size={11} /> Admin task
      </span>
    ) : (
      "Your next step"
    );

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

      {nextStep &&
        (nextStep.actions ||
        nextStep.closeDay1 ||
        nextStep.lockPartnerDraft ||
        nextStep.closeDay2 ||
        nextStep.finalizeMatchDraft ||
        nextStep.completeDay3 ? (
          <div
            className={cn(
              "rounded-2xl p-4 mb-5 border-2",
              tileGreen
                ? "bg-primary text-white border-primary"
                : "bg-accent border-secondary/40",
            )}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xl",
                  tileGreen ? "bg-white/20" : "bg-secondary/15",
                )}
              >
                {nextStep.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest mb-0.5",
                    tileGreen ? "text-green-200" : "text-secondary",
                  )}
                >
                  {stepEyebrow}
                </p>
                <p
                  className={cn(
                    "font-bold text-base leading-snug",
                    tileGreen ? "text-white" : "text-foreground",
                  )}
                >
                  {nextStep.label}
                </p>
                {nextStep.sub && (
                  <p
                    className={cn(
                      "text-xs mt-0.5",
                      tileGreen ? "text-green-200" : "text-muted-foreground",
                    )}
                  >
                    {nextStep.sub}
                  </p>
                )}
              </div>
            </div>
            {nextStep.closeDay1 ? (
              <CloseDay1Button />
            ) : nextStep.lockPartnerDraft ? (
              <LockDraftButton />
            ) : nextStep.closeDay2 ? (
              <AdminCompleteButton action={completeDay2} label="Close Day 2 scoring" confirmLabel="Yes, close scoring" />
            ) : nextStep.finalizeMatchDraft ? (
              <AdminCompleteButton action={completeDay2Draft} label="Finalize Match Play Draft" confirmLabel="Yes, lock the teams" />
            ) : nextStep.completeDay3 ? (
              <AdminCompleteButton action={completeDay3} label="Complete Day 3" confirmLabel="Yes, finalize the Huron Cup" />
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {nextStep.actions?.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className={cn(
                      "h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform",
                      tileGreen ? "bg-white text-primary" : "bg-primary text-white",
                    )}
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Link href={nextStep.href}>
            <div
              className={cn(
                "rounded-2xl p-4 mb-5 flex items-center gap-4 active:scale-[0.98] transition-transform border-2",
                tileGreen
                  ? "bg-primary text-white border-primary"
                  : "bg-accent border-secondary/40",
              )}
            >
              <div
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xl",
                  tileGreen ? "bg-white/20" : "bg-secondary/15",
                )}
              >
                {nextStep.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest mb-0.5",
                    tileGreen ? "text-green-200" : "text-secondary",
                  )}
                >
                  {stepEyebrow}
                </p>
                <p
                  className={cn(
                    "font-bold text-base leading-snug",
                    tileGreen ? "text-white" : "text-foreground",
                  )}
                >
                  {nextStep.label}
                </p>
                {nextStep.sub && (
                  <p
                    className={cn(
                      "text-xs mt-0.5",
                      tileGreen ? "text-green-200" : "text-muted-foreground",
                    )}
                  >
                    {nextStep.sub}
                  </p>
                )}
              </div>
              <ArrowRight size={20} className={tileGreen ? "text-white/80" : "text-muted-foreground"} />
            </div>
          </Link>
        ))}

      {seasonComplete ? (
        <div className="flex flex-col gap-3 mb-5">
          <ChampionTile
            href={`/${yr}/day2/leaderboard`}
            eyebrow="Pairs Champion"
            emoji="🏆"
            title={
              pairsChamp
                ? `${pairsChamp.player1Name} & ${pairsChamp.player2Name}`
                : "—"
            }
            subtitle={
              pairsChamp?.combinedNet != null
                ? `Combined net ${formatNet(pairsChamp.combinedNet)}`
                : "Pairs competition"
            }
            tone="gold"
          />
          <ChampionTile
            href={`/${yr}/day3/leaderboard`}
            eyebrow="Huron Cup"
            emoji={huronTie ? "🤝" : truffleWonCup ? "🐗" : "🍄"}
            title={
              huronTie
                ? "It's a Draw"
                : truffleWonCup
                  ? "Truffle Hogs"
                  : "Mycelium Syndicate"
            }
            subtitle={`${hc.trufflePoints}–${hc.syndicatePoints} · Huron Cup ${season.year}`}
            tone={huronTie ? "muted" : truffleWonCup ? "truffle" : "syndicate"}
          />
        </div>
      ) : (
      <div className="flex flex-col gap-3 mb-5">
        {/* Day 1 has no per-card completion button — the "next step" tile above
            already surfaces "Close scoring & start picks" (CloseDay1Button). */}
        <DayCard day={1} title={`Day 1 — ${dayLabel(1, "Just You")}`} subtitle="9 holes · Solo, net" complete={state?.day1Complete} href={`/${yr}/day1/leaderboard`} icon={<Trophy size={22} className="text-gold" />} />
        {state?.day1Complete && (
          <Link href={`/${yr}/day1/picks`} className="-mt-1 ml-8">
            <div
              className={cn(
                "bg-white rounded-xl p-3 border flex items-center gap-3 transition-all active:scale-[0.98]",
                state.day1PickingComplete ? "border-primary/40" : "border-border",
              )}
            >
              <div className="w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center text-base flex-shrink-0">
                🤝
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Partner Draft</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {state.day1PickingComplete
                    ? "Teams set"
                    : picks.nextPicker
                      ? `${picks.nextPicker.name} is picking`
                      : state.day1PickingStarted
                        ? "Pairs set — lock to finalize"
                        : "Draft not started"}
                </p>
              </div>
              {state.day1PickingComplete ? (
                <Check size={16} className="text-green-600 flex-shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
              )}
            </div>
          </Link>
        )}
        {/* Partner draft is locked from the "next step" tile (LockDraftButton),
            not a card button — keeps a single completion affordance. */}
        <DayCard day={2} title={`Day 2 — ${dayLabel(2, "Partner Up")}`} subtitle="27 holes · Pairs, combined net" complete={state?.day2Complete} href={`/${yr}/day2/leaderboard`} icon={<Users size={22} className="text-gold" />} />
        {state?.day2Complete && (
          <Link href={`/${yr}/day2/draft`} className="-mt-1 ml-8">
            <div
              className={cn(
                "bg-white rounded-xl p-3 border flex items-center gap-3 transition-all active:scale-[0.98]",
                state?.day2DraftComplete ? "border-primary/40" : "border-border",
              )}
            >
              <div className="w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center text-base flex-shrink-0">
                ⚔️
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Match Play Draft</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {state?.day2DraftComplete ? "Teams drafted" : "Draft the two teams"}
                </p>
              </div>
              {state?.day2DraftComplete ? (
                <Check size={16} className="text-green-600 flex-shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
              )}
            </div>
          </Link>
        )}
        {/* Day 2 / Match Play Draft / Day 3 completions live in the "next step"
            tile at the top, not as card buttons. */}
        <DayCard day={3} title={`Day 3 — ${dayLabel(3, "10 v 10")}`} subtitle="Truffle Hogs vs Mycelium Syndicate · Huron Cup" complete={state?.day3Complete} href={`/${yr}/day3/leaderboard`} icon={<Flag size={22} className="text-gold" />} />
      </div>
      )}

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

// Season-complete summary tile: the Pairs champion and the Huron Cup winner
// replace the stage stack once the tournament is over.
function ChampionTile({
  href,
  eyebrow,
  emoji,
  title,
  subtitle,
  tone,
}: {
  href: string;
  eyebrow: string;
  emoji: string;
  title: string;
  subtitle: string;
  tone: "gold" | "truffle" | "syndicate" | "muted";
}) {
  const toneClass =
    tone === "truffle"
      ? "bg-truffle-light border-truffle/30"
      : tone === "syndicate"
        ? "bg-syndicate-light border-syndicate/30"
        : tone === "gold"
          ? "bg-gold/10 border-gold/30"
          : "bg-muted border-border";
  return (
    <Link href={href}>
      <div
        className={cn(
          "rounded-2xl p-5 border flex items-center gap-4 active:scale-[0.98] transition-transform",
          toneClass,
        )}
      >
        <div className="w-14 h-14 rounded-full bg-white/70 flex items-center justify-center text-3xl flex-shrink-0">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            {eyebrow}
          </p>
          <p className="text-xl font-bold font-heading leading-tight truncate">
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        </div>
        <Trophy size={20} className="text-gold flex-shrink-0" />
      </div>
    </Link>
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
        {complete ? (
          <Check size={18} className="text-green-600 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
        )}
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
  // Which "hat" the action is for. Admins are also players, so we badge
  // admin-scoped steps to disambiguate ("manage the tournament" vs "your turn").
  audience?: "admin" | "player";
  // When present, the tile renders these as tappable buttons instead of being a
  // single link (e.g. Day 1: enter manually vs. pull from The Grint).
  actions?: { label: string; href: string }[];
  // When true, the tile renders the "close Day 1 scoring" action button.
  closeDay1?: boolean;
  // When true, the tile renders the "lock the partner draft" action button.
  lockPartnerDraft?: boolean;
  // When true, the tile renders the "close Day 2 scoring" action button.
  closeDay2?: boolean;
  // When true, the tile renders the "finalize match play draft" action button.
  finalizeMatchDraft?: boolean;
  // When true, the tile renders the "complete Day 3" action button.
  completeDay3?: boolean;
};

function computeNextStep(args: {
  state: Awaited<ReturnType<typeof getSeasonState>>;
  userId: number | null;
  isAdmin: boolean;
  day1Lb: Awaited<ReturnType<typeof getDay1Leaderboard>>;
  picks: Awaited<ReturnType<typeof getDay1PicksOverview>>;
  matches: Awaited<ReturnType<typeof getDay3Matches>>;
  rosterCount: number;
  day2AllScored: boolean;
  matchDraftReady: boolean;
  day3AllDecided: boolean;
}): NextStep | null {
  const {
    state,
    userId,
    isAdmin,
    day1Lb,
    picks,
    matches,
    rosterCount,
    day2AllScored,
    matchDraftReady,
    day3AllDecided,
  } = args;
  if (!state) return null;

  if (!state.day3Complete && state.day2DraftComplete) {
    // Admin can finalize the Huron Cup once every match is decided.
    if (isAdmin && day3AllDecided) {
      return {
        label: "Complete Day 3",
        sub: "Every match is decided — finalize the Huron Cup.",
        href: "/day3/leaderboard",
        emoji: "🏁",
        urgent: true,
        audience: "admin",
        completeDay3: true,
      };
    }
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

  if (state.day1PickingComplete && !state.day2DraftComplete) {
    if (day2AllScored) {
      // Admin drives the close-out: close Day 2 scoring → draft teams → finalize.
      if (isAdmin) {
        if (!state.day2Complete) {
          return {
            label: "Close Day 2 scoring",
            sub: "All pairs are in — lock the Pairs standings.",
            href: "/day2/leaderboard",
            emoji: "🔒",
            urgent: true,
            audience: "admin",
            closeDay2: true,
          };
        }
        if (!matchDraftReady) {
          return {
            label: "Match Play Draft",
            sub: "Draft the Sunday matchups",
            href: "/day3/setup",
            emoji: "⚔️",
            urgent: true,
            audience: "admin",
          };
        }
        return {
          label: "Finalize Match Play Draft",
          sub: "Teams are drafted — lock them in for Sunday.",
          href: "/day2/draft",
          emoji: "🔒",
          urgent: true,
          audience: "admin",
          finalizeMatchDraft: true,
        };
      }
      // Everyone else: the draft is underway.
      return {
        label: "Match Play Draft",
        sub: "Day 2 is in — the 10 v 10 teams are being drafted",
        href: "/day2/draft",
        emoji: "⚔️",
        urgent: false,
      };
    }
    if (isAdmin) {
      // Admin drives Day 2 like Day 1: an actionable score-entry prompt (not a
      // passive "view leaderboard"). Once every pair is scored, the day2AllScored
      // branch above advances to the Match Play Draft, and the Day 2 card shows
      // its "Close Day 2 scoring" button.
      return {
        label: "Enter everyone's Day 2 scores",
        sub: "27 holes · pull from The Grint or enter manually",
        href: "/day2/scores",
        emoji: "🤝",
        urgent: true,
        audience: "admin",
      };
    }
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

  // Day 1 must be fully scored before partner-picking is offered.
  if (state.day1Complete && !state.day1PickingComplete) {
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
          audience: isAdmin ? "admin" : "player",
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
    // No next picker but picking isn't locked → all pairs are made, awaiting an
    // admin lock (the draft no longer auto-locks on the final pick).
    if (state.day1PickingStarted) {
      if (isAdmin) {
        return {
          label: "Lock the partner draft",
          sub: "All pairs are set — lock them in to start Day 2.",
          href: "/day1/picks",
          emoji: "🔒",
          urgent: true,
          audience: "admin",
          lockPartnerDraft: true,
        };
      }
      return {
        label: "Partner draft complete",
        sub: "Waiting for the organizer to lock the pairs",
        href: "/day1/picks",
        emoji: "🤝",
        urgent: false,
      };
    }
  }

  if (!state.day1Complete) {
    const entryActions = [
      { label: "Enter manually", href: "/day1/scores" },
      { label: "Pull from Grint", href: "/day1/scores?pull=1" },
    ];
    if (userId) {
      const hasScored = day1Lb.find((e) => e.id === userId);
      if (hasScored) {
        return {
          label: "View Day 1 leaderboard",
          sub: `Your net score: ${formatNet(hasScored.netScore)} · Rank #${hasScored.rank}`,
          href: "/day1/leaderboard",
          emoji: "🏌️",
          urgent: false,
        };
      }
      return {
        label: "Enter your Day 1 score",
        href: "/day1/scores",
        emoji: "🏌️",
        urgent: true,
        actions: entryActions,
        audience: "player",
      };
    }
    if (isAdmin) {
      const allScored = rosterCount > 0 && day1Lb.length >= rosterCount;
      if (allScored) {
        return {
          label: "Close Day 1 scoring",
          sub: `All ${rosterCount} scores are in — lock the standings and start partner picks.`,
          href: "/day1/leaderboard",
          emoji: "🔒",
          urgent: true,
          audience: "admin",
          closeDay1: true,
        };
      }
      return {
        label: "Enter everyone's Day 1 scores",
        sub: "Pull from The Grint or enter manually, then close scoring",
        href: "/day1/scores",
        emoji: "🏌️",
        urgent: true,
        actions: entryActions,
        audience: "admin",
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
