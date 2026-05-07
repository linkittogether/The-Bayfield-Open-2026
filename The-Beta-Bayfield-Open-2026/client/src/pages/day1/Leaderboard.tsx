import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Trophy, ClipboardList, Users } from 'lucide-react';
import { cn, ordinal } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const medals = ['🥇', '🥈', '🥉'];

export function Day1Leaderboard() {
  const { data: lb, loading, error } = useApi(() => api.getDay1Leaderboard(), [], 10000);
  const { data: players } = useApi(() => api.getPlayers(), []);
  const { data: state } = useApi(() => api.getTournament(), [], 10000);
  const { user } = useAuth();
  const userId = user?.type === 'player' ? user.id : null;

  const hasScores = lb && lb.length > 0;
  const notScored = (players || []).filter(p => !lb?.find(e => e.id === p.id));

  return (
    <Layout title="Day 1 Leaderboard">
      {/* Action buttons */}
      <div className="mb-5">
        <Link href="/day1/scores">
          <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-semibold active:scale-[0.97]">
            <ClipboardList size={16} /> Enter Score
          </button>
        </Link>
      </div>

      {!hasScores && !loading && (
        <div className="bg-[hsl(var(--muted))] rounded-2xl p-8 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
          <p className="font-semibold text-[hsl(var(--muted-foreground))]">No scores yet</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Register players and enter scores to see the leaderboard</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
      )}

      {hasScores && (
        <div className="space-y-2">
          {lb.map((entry, i) => {
            const isMe = userId === entry.id;
            return (
            <div
              key={entry.id}
              className={cn(
                "rounded-xl border flex items-center gap-3 p-3 transition-all",
                isMe
                  ? "bg-[hsl(var(--primary)/0.07)] border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary)/0.3)]"
                  : i < 3 ? "bg-white border-[hsl(var(--primary)/0.3)]"
                  : i === 9 ? "bg-white border-[hsl(var(--secondary))] ring-1 ring-[hsl(var(--secondary))]"
                  : "bg-white border-[hsl(var(--border))]"
              )}
              data-testid={`row-player-${entry.id}`}
            >
              <div className="w-8 text-center font-bold text-sm text-[hsl(var(--muted-foreground))]">
                {medals[i] || ordinal(i + 1)}
              </div>
              <PlayerAvatar name={entry.name} photoUrl={entry.photo_url} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{entry.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">HCP {entry.handicap} · Gross {entry.gross_score}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-lg leading-none">{entry.net_score}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">net</p>
              </div>
              {isMe && <span className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] px-1.5 py-0.5 rounded-full flex-shrink-0">You</span>}
            </div>
            );
          })}
        </div>
      )}

      {/* Not yet scored */}
      {notScored.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
            Awaiting Score ({notScored.length})
          </h3>
          <div className="space-y-2">
            {notScored.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-dashed border-[hsl(var(--border))] flex items-center gap-3 p-3">
                <PlayerAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                <p className="text-sm text-[hsl(var(--muted-foreground))] truncate flex-1">{p.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">HCP {p.handicap}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partner picking CTA */}
      {hasScores && lb.length >= 20 && !state?.day1_picking_complete && (
        <div className="mt-5 bg-[hsl(var(--accent))] rounded-2xl p-4 border border-[hsl(var(--secondary)/0.3)]">
          <p className="font-semibold text-sm mb-1">Ready to pick partners!</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">All 20 players have scores. Start the Day 2 partner selection.</p>
          <Link href="/day1/picks">
            <button className="w-full bg-[hsl(var(--secondary))] text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2">
              <Users size={16} /> Start Partner Pick
            </button>
          </Link>
        </div>
      )}

      {state?.day1_picking_complete && (
        <div className="mt-5 bg-green-50 rounded-2xl p-4 border border-green-200">
          <p className="font-semibold text-sm text-green-800 mb-1">Partners selected! ✓</p>
          <Link href="/day1/picks">
            <button className="text-sm text-green-700 underline">View pairings →</button>
          </Link>
        </div>
      )}
    </Layout>
  );
}
