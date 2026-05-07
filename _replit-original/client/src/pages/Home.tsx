import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Trophy, Users, Flag, ChevronRight, ArrowRight, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function Home() {
  const { data: state, loading } = useApi(() => api.getTournament(), [], 5000);
  const { data: players } = useApi(() => api.getPlayers(), []);
  const { data: day1Lb } = useApi(() => api.getDay1Leaderboard(), [], 5000);
  const { data: picks } = useApi(() => api.getDay1Picks(), [], 5000);
  const { data: matches } = useApi(() => api.getDay3Matches(), [], 5000);
  const { user, isAdmin } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const nextStep = getNextStep({ state, user, isAdmin, day1Lb, picks, matches });

  return (
    <Layout>
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-5 bg-[hsl(var(--primary))] text-white p-5 pb-6">
        <div className="flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Bayfield Open"
            className="h-24 w-24 object-contain mb-3"
            style={{ filter: 'invert(1)' }}
          />
          <p className="text-green-200 text-xs font-medium mb-1 uppercase tracking-widest">2026 Tournament</p>
          <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
            The Bayfield Open
          </h2>
          <p className="text-green-100 text-sm">
            {players?.length || 0} players · 3 days · All The Mushrooms
          </p>
        </div>
      </div>

      {/* Next Step CTA */}
      {nextStep && (
        <Link href={nextStep.href}>
          <div className={cn(
            "rounded-2xl p-4 mb-5 flex items-center gap-4 active:scale-[0.98] transition-transform border-2",
            nextStep.urgent
              ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
              : "bg-[hsl(var(--accent))] border-[hsl(var(--secondary)/0.4)]"
          )}>
            <div className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xl",
              nextStep.urgent ? "bg-white/20" : "bg-[hsl(var(--secondary)/0.15)]"
            )}>
              {nextStep.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-widest mb-0.5",
                nextStep.urgent ? "text-green-200" : "text-[hsl(var(--secondary))]"
              )}>
                Your next step
              </p>
              <p className={cn(
                "font-bold text-base leading-snug",
                nextStep.urgent ? "text-white" : "text-[hsl(var(--foreground))]"
              )}>
                {nextStep.label}
              </p>
              {nextStep.sub && (
                <p className={cn(
                  "text-xs mt-0.5",
                  nextStep.urgent ? "text-green-200" : "text-[hsl(var(--muted-foreground))]"
                )}>
                  {nextStep.sub}
                </p>
              )}
            </div>
            <ArrowRight size={20} className={nextStep.urgent ? "text-white/80" : "text-[hsl(var(--muted-foreground))]"} />
          </div>
        </Link>
      )}

      {/* Day cards */}
      <div className="space-y-3 mb-5">
        <DayCard
          day={1}
          title="Day 1 — Just You"
          subtitle="9 holes · Handicap scoring · Partner pick"
          complete={state?.day1_complete}
          href="/day1/leaderboard"
          icon={<Trophy size={22} className="text-[hsl(var(--gold))]" />}
        />
        <DayCard
          day={2}
          title="Day 2 — Partner Up"
          subtitle="27 holes · Combined net score"
          complete={state?.day2_complete}
          href="/day2/leaderboard"
          icon={<Users size={22} className="text-[hsl(var(--gold))]" />}
        />
        <DayCard
          day={3}
          title="Day 3 — 10 v 10"
          subtitle="Truffle Hogs vs Mycelium Syndicate · Huron Cup"
          complete={state?.day3_complete}
          href="/day3/leaderboard"
          icon={<Flag size={22} className="text-[hsl(var(--gold))]" />}
        />
      </div>

      {/* Teams preview */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link href="/day2/draft">
          <div className="bg-[hsl(var(--truffle-light))] rounded-xl p-3 text-center active:scale-[0.97] transition-transform">
            <p className="text-xl mb-1">🐗</p>
            <p className="text-xs font-bold text-[hsl(var(--truffle))] leading-tight">The Truffle Hogs</p>
          </div>
        </Link>
        <Link href="/day2/draft#syndicate">
          <div className="bg-[hsl(var(--syndicate-light))] rounded-xl p-3 text-center active:scale-[0.97] transition-transform">
            <p className="text-xl mb-1">🍄</p>
            <p className="text-xs font-bold text-[hsl(var(--syndicate))] leading-tight">Mycelium Syndicate</p>
          </div>
        </Link>
      </div>

      {/* Admin panel link — only visible to admins */}
      {isAdmin && (
        <Link href="/admin">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-white active:scale-[0.98] transition-transform">
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary)/0.08)] flex items-center justify-center flex-shrink-0">
              <Settings size={16} className="text-[hsl(var(--primary))]" />
            </div>
            <span className="flex-1 text-sm font-medium">Admin Panel</span>
            <ChevronRight size={16} className="text-[hsl(var(--muted-foreground))]" />
          </div>
        </Link>
      )}
    </Layout>
  );
}

type NextStep = { label: string; sub?: string; href: string; emoji: string; urgent: boolean };

function getNextStep({ state, user, isAdmin, day1Lb, picks, matches }: {
  state: any; user: any; isAdmin: boolean;
  day1Lb: any; picks: any; matches: any;
}): NextStep | null {
  if (!state) return null;

  const userId = user?.type === 'player' ? user.id : null;

  // ── Day 3 active ──
  if (!state.day3_complete && (state.day2_complete || state.day2_draft_complete)) {
    if (matches && matches.length > 0 && userId) {
      const myMatch = matches.find(
        (m: any) => m.truffle_player_id === userId || m.syndicate_player_id === userId
      );
      if (myMatch) {
        const myHoles = (myMatch.truffle_holes_won || 0) + (myMatch.syndicate_holes_won || 0) + (myMatch.tied_holes || 0);
        const done = myHoles >= 18;
        return {
          label: done ? 'See the Huron Cup results' : 'Score your match',
          sub: done
            ? 'Your match is complete — check the leaderboard'
            : `vs. ${myMatch.truffle_player_id === userId ? myMatch.syndicate_player_name : myMatch.truffle_player_name} · Hole ${myHoles + 1} of 18`,
          href: done ? '/day3/leaderboard' : `/day3/match/${myMatch.id}`,
          emoji: '⛳',
          urgent: !done,
        };
      }
    }
    return {
      label: 'Check the Huron Cup',
      sub: 'Day 3 match play is underway',
      href: '/day3/leaderboard',
      emoji: '🏆',
      urgent: false,
    };
  }

  if (state.day3_complete) {
    return {
      label: 'See who won the Huron Cup',
      sub: 'Tournament complete — final results are in!',
      href: '/day3/leaderboard',
      emoji: '🏆',
      urgent: false,
    };
  }

  // ── Day 2 active ──
  if (state.day1_picking_complete && !state.day2_complete && !state.day2_draft_complete) {
    if (userId) {
      return {
        label: 'Enter your Day 2 score',
        sub: '27 holes · 3 rounds with your partner',
        href: '/day2/scores',
        emoji: '🤝',
        urgent: true,
      };
    }
    return {
      label: 'View Day 2 leaderboard',
      sub: 'Partner play is underway',
      href: '/day2/leaderboard',
      emoji: '🤝',
      urgent: false,
    };
  }

  // ── Picking phase ──
  if (!state.day1_picking_complete) {
    const nextPicker = picks?.nextPicker;
    if (nextPicker) {
      const isMyTurn = userId && nextPicker.id === userId;
      if (isMyTurn || isAdmin) {
        return {
          label: isAdmin ? `${nextPicker.name} is picking a partner` : 'Pick your partner!',
          sub: isAdmin
            ? 'Head to partner selection to record their pick'
            : `It's your turn — choose your Day 2 partner`,
          href: '/day1/picks',
          emoji: '🤜',
          urgent: true,
        };
      }
      return {
        label: 'Partner selection in progress',
        sub: `Waiting for ${nextPicker.name} to pick`,
        href: '/day1/picks',
        emoji: '🤜',
        urgent: false,
      };
    }
  }

  // ── Day 1 scoring ──
  if (!state.day1_complete) {
    if (userId) {
      const hasScored = day1Lb?.find((e: any) => e.id === userId);
      return {
        label: hasScored ? 'View Day 1 leaderboard' : 'Enter your Day 1 score',
        sub: hasScored
          ? `Your net score: ${hasScored.net_score} · Rank #${hasScored.rank}`
          : '9 holes · Your gross score goes in here',
        href: hasScored ? '/day1/leaderboard' : '/day1/scores',
        emoji: '🏌️',
        urgent: !hasScored,
      };
    }
    return {
      label: 'View Day 1 leaderboard',
      sub: 'Scores are being entered',
      href: '/day1/leaderboard',
      emoji: '🏌️',
      urgent: false,
    };
  }

  return null;
}

function DayCard({ day, title, subtitle, complete, href, icon }: {
  day: number; title: string; subtitle: string;
  complete?: boolean; href: string; icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <div className={cn(
        "bg-white rounded-xl p-4 border flex items-center gap-4 transition-all active:scale-[0.98]",
        complete ? "border-[hsl(var(--primary))]" : "border-[hsl(var(--border))]"
      )}>
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0",
          complete ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
        )}>
          {complete ? icon : day}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{subtitle}</p>
        </div>
        <ChevronRight size={16} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" />
      </div>
    </Link>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <Link href={href}>
      <button className="w-full bg-white border border-[hsl(var(--border))] rounded-xl py-3 px-4 text-sm font-medium text-left flex items-center gap-2 active:scale-[0.97] transition-transform">
        {icon}
        {label}
      </button>
    </Link>
  );
}
