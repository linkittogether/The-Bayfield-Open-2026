import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Trophy, ClipboardList } from 'lucide-react';
import { cn, ordinal } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function Day2Leaderboard() {
  const { data: lb, loading } = useApi(() => api.getDay2Leaderboard(), [], 8000);
  const { data: state } = useApi(() => api.getTournament(), [], 8000);
  const { user } = useAuth();
  const userId = user?.type === 'player' ? user.id : null;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <Layout title="Day 2 Leaderboard">
      <div className="mb-5">
        <Link href="/day2/scores">
          <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-semibold">
            <ClipboardList size={16} /> Enter Score
          </button>
        </Link>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">Live · Updates every 8 seconds</span>
      </div>

      {loading && !lb && (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
      )}

      {lb && lb.length === 0 && (
        <div className="bg-[hsl(var(--muted))] rounded-2xl p-8 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
          <p className="font-semibold text-[hsl(var(--muted-foreground))]">No teams yet</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Complete Day 1 partner selection first</p>
          <Link href="/day1/picks">
            <button className="mt-3 text-sm text-[hsl(var(--primary))] underline">Go to partner selection →</button>
          </Link>
        </div>
      )}

      {lb && lb.length > 0 && (
        <div className="space-y-3">
          {lb.map((entry, i) => {
            const isMe = userId && (entry.player1_id === userId || entry.player2_id === userId);
            const rounds = entry.round_scores || [];
            return (
              <div
                key={entry.team_id}
                className={cn(
                  "rounded-xl border overflow-hidden",
                  isMe
                    ? "bg-[hsl(var(--primary)/0.05)] border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary)/0.3)]"
                    : i === 0 ? "bg-white border-[hsl(var(--gold))] ring-1 ring-[hsl(var(--gold)/0.5)]"
                    : i === 1 ? "bg-white border-gray-300"
                    : "bg-white border-[hsl(var(--border))]"
                )}
                data-testid={`row-team-${entry.team_id}`}
              >
                <div className="p-3 flex items-center gap-3">
                  <div className="w-8 text-center font-bold text-sm">
                    {medals[i] || ordinal(i + 1)}
                  </div>
                  <div className="flex -space-x-2 flex-shrink-0">
                    <PlayerAvatar name={entry.player1_name} photoUrl={entry.player1_photo} size="sm" />
                    <PlayerAvatar name={entry.player2_name} photoUrl={entry.player2_photo} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{entry.player1_name} & {entry.player2_name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {entry.rounds_complete}/3 rounds · HCP {entry.player1_handicap}/{entry.player2_handicap}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isMe && <span className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] px-1.5 py-0.5 rounded-full">You</span>}
                    <div className="text-right">
                      <p className="font-bold text-xl leading-none">{entry.total_net_score || '—'}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">net</p>
                    </div>
                  </div>
                </div>

                {rounds.length > 0 && (
                  <div className="border-t border-[hsl(var(--border))] px-3 py-2 grid grid-cols-3 gap-2">
                    {[1, 2, 3].map(r => {
                      const rs = rounds.find((x: { round: number }) => x.round === r);
                      return (
                        <div key={r} className="text-center">
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">R{r}</p>
                          <p className={cn("text-sm font-semibold", rs ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--border))]")}>
                            {rs ? rs.net_score : '—'}
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

      {lb && lb.length > 0 && lb.every(e => e.rounds_complete >= 3) && (
        <div className="mt-5 bg-[hsl(var(--primary))] text-white rounded-2xl p-5 text-center">
          <Trophy size={36} className="mx-auto mb-2 text-[hsl(var(--gold))]" />
          <p className="font-bold text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>
            Bayfield Open Champions!
          </p>
          <p className="text-green-200 text-sm mt-1">
            {lb[0].player1_name} & {lb[0].player2_name} with {lb[0].total_net_score} net
          </p>
          {!state?.day2_draft_complete && (
            <Link href="/day2/draft">
              <button className="mt-4 bg-white text-[hsl(var(--primary))] rounded-xl py-3 px-6 font-semibold text-sm w-full">
                Proceed to Day 3 Draft
              </button>
            </Link>
          )}
        </div>
      )}
    </Layout>
  );
}
