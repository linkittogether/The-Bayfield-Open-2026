import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Flag, Settings, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Day3Leaderboard() {
  const { data: lb, loading } = useApi(() => api.getDay3Leaderboard(), [], 5000);
  const { data: matches } = useApi(() => api.getDay3Matches(), [], 5000);
  const { data: state } = useApi(() => api.getTournament(), [], 5000);
  const { data: teams } = useApi(() => api.getDay3Teams(), [], 30000);
  const { user, isAdmin } = useAuth();

  const userId = user?.type === 'player' ? user.id : null;
  const allPlayers = [...(teams?.truffle_hogs || []), ...(teams?.mycelium_syndicate || [])];
  const isCaptain = userId && allPlayers.some(p => p.player_id === userId && p.is_captain);
  const canSetupMatches = isAdmin || isCaptain;

  const s = lb?.summary;
  const truffleWins = parseInt(String(s?.truffle_match_wins || 0));
  const syndicateWins = parseInt(String(s?.syndicate_match_wins || 0));
  const truffleLeading = truffleWins > syndicateWins;
  const tie = truffleWins === syndicateWins;

  return (
    <Layout title="Day 3 — Huron Cup">
      {canSetupMatches && (
        <div className="mb-5">
          <Link href="/day3/setup">
            <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-semibold">
              <Settings size={16} /> Setup Matches
            </button>
          </Link>
        </div>
      )}

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">Live · Updates every 5 seconds</span>
      </div>

      {loading && !lb && (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
      )}

      {/* Overall score banner */}
      {s && (
        <div className="bg-[hsl(var(--primary))] text-white rounded-2xl p-4 mb-5">
          <p className="text-green-200 text-xs text-center uppercase tracking-widest mb-3">Huron Cup</p>
          <div className="grid grid-cols-3 items-center text-center">
            <div className={cn(truffleLeading && "scale-110 transition-transform")}>
              <p className="text-2xl mb-1">🐗</p>
              <p className="text-xs text-green-200">Truffle Hogs</p>
              <p className="text-4xl font-bold">{truffleWins}</p>
              <p className="text-xs text-green-200">match wins</p>
            </div>
            <div>
              <p className="text-green-200 text-sm font-medium">vs</p>
              {tie && (truffleWins > 0 || syndicateWins > 0) && (
                <p className="text-xs text-green-300 mt-1">Tied!</p>
              )}
            </div>
            <div className={cn(!truffleLeading && !tie && "scale-110 transition-transform")}>
              <p className="text-2xl mb-1">🍄</p>
              <p className="text-xs text-green-200">Mycelium Syndicate</p>
              <p className="text-4xl font-bold">{syndicateWins}</p>
              <p className="text-xs text-green-200">match wins</p>
            </div>
          </div>
          {parseInt(String(s.tied_matches)) > 0 && (
            <p className="text-center text-xs text-green-300 mt-2">{s.tied_matches} tied match{s.tied_matches > 1 ? 'es' : ''}</p>
          )}
        </div>
      )}

      {/* Winner banner */}
      {matches && matches.every(m => parseInt(String(m.holes_played)) === 18) && s && (
        <div className={cn(
          "rounded-2xl p-5 text-center mb-5",
          truffleLeading ? "bg-[hsl(var(--truffle-light))] border border-[hsl(var(--truffle)/0.3)]" :
          !tie ? "bg-[hsl(var(--syndicate-light))] border border-[hsl(var(--syndicate)/0.3)]" :
          "bg-[hsl(var(--muted))]"
        )}>
          <Trophy size={36} className="mx-auto mb-2 text-[hsl(var(--gold))]" />
          <p className="font-bold text-2xl" style={{ fontFamily: 'Playfair Display, serif' }}>
            {truffleLeading ? '🐗 Truffle Hogs Win!' :
             !tie ? '🍄 Mycelium Syndicate Wins!' :
             'It\'s a Draw!'}
          </p>
          <p className="text-sm mt-1 text-[hsl(var(--muted-foreground))]">Huron Cup Champions 2026</p>
        </div>
      )}

      {/* Match list */}
      {matches && matches.length === 0 && (
        <div className="text-center py-10">
          <Flag size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
          <p className="font-semibold text-[hsl(var(--muted-foreground))]">No matches set up yet</p>
          {canSetupMatches && (
            <Link href="/day3/setup">
              <button className="mt-3 text-sm text-[hsl(var(--primary))] underline">Set up matches →</button>
            </Link>
          )}
        </div>
      )}

      {matches && matches.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Matches</h3>
          <div className="space-y-2">
            {matches.map(m => {
              const th = parseInt(String(m.truffle_holes_won));
              const sh = parseInt(String(m.syndicate_holes_won));
              const hp = parseInt(String(m.holes_played));
              const complete = hp === 18;
              const leading = th > sh ? 'truffle' : sh > th ? 'syndicate' : 'tie';
              const isMyMatch = userId && (m.truffle_player_id === userId || m.syndicate_player_id === userId);
              return (
                <Link key={m.id} href={`/day3/match/${m.id}`}>
                  <div className={cn(
                    "border rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform",
                    isMyMatch
                      ? "bg-[hsl(var(--primary)/0.05)] border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary)/0.3)]"
                      : "bg-white border-[hsl(var(--border))]"
                  )}>
                    <div className="text-center w-7 flex-shrink-0">
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">M{m.match_number}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        <span className={cn(leading === 'truffle' && !complete ? "font-bold" : "")}>{m.truffle_player_name}</span>
                        <span className="text-[hsl(var(--muted-foreground))] mx-1">vs</span>
                        <span className={cn(leading === 'syndicate' && !complete ? "font-bold" : "")}>{m.syndicate_player_name}</span>
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{hp}/18 holes</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isMyMatch && <span className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] px-1.5 py-0.5 rounded-full">You</span>}
                      <div className="flex items-center gap-1 text-sm font-bold">
                        <span className={cn(th > sh ? "text-[hsl(var(--truffle))]" : "text-[hsl(var(--muted-foreground))]")}>{th}</span>
                        <span className="text-[hsl(var(--muted-foreground))] text-xs">-</span>
                        <span className={cn(sh > th ? "text-[hsl(var(--syndicate))]" : "text-[hsl(var(--muted-foreground))]")}>{sh}</span>
                      </div>
                    </div>
                    {complete && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">Done</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Layout>
  );
}
