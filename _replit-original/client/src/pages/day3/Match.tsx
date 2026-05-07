import { useParams } from 'wouter';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Undo2, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type HoleWinner = 'truffle_hogs' | 'mycelium_syndicate' | 'tie';

export function Day3Match() {
  const params = useParams<{ id: string }>();
  const matchId = parseInt(params.id);
  const { data: match, loading, refetch } = useApi(() => api.getDay3Match(matchId), [matchId], 5000);
  const { user, isAdmin, isPlayer } = useAuth();
  const [saving, setSaving] = useState(false);

  const canScore = isAdmin || (
    !!match && (
      isPlayer(match.truffle_player_id) ||
      isPlayer(match.syndicate_player_id)
    )
  );

  const authFields = {
    is_admin: isAdmin,
    auth_player_id: user?.type === 'player' ? user.id : undefined,
    auth_pin: user?.type === 'player' ? user.pin : undefined,
  };

  const submitted = new Map(match?.holes.map(h => [h.hole_number, h.winner]) || []);

  const truffleHoles = match?.holes.filter(h => h.winner === 'truffle_hogs').length || 0;
  const syndicateHoles = match?.holes.filter(h => h.winner === 'mycelium_syndicate').length || 0;
  const tiedHoles = match?.holes.filter(h => h.winner === 'tie').length || 0;
  const holesLeft = 18 - (match?.holes.length || 0);

  const submitHole = async (holeNumber: number, winner: HoleWinner) => {
    if (!canScore) return;
    setSaving(true);
    try {
      await api.submitHole({ match_id: matchId, hole_number: holeNumber, winner, ...authFields });
      await refetch();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const undoHole = async (holeNumber: number) => {
    if (!canScore) return;
    setSaving(true);
    try {
      await api.deleteHole(matchId, holeNumber, authFields);
      await refetch();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <Layout title="Match Scoring" showBack backTo="/day3/leaderboard">
      <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
    </Layout>
  );

  if (!match) return (
    <Layout title="Match Not Found" showBack backTo="/day3/leaderboard">
      <p className="text-center text-[hsl(var(--muted-foreground))] py-10">Match not found</p>
    </Layout>
  );

  const nextHole = (match.holes.length || 0) + 1;

  return (
    <Layout title={`Match ${match.match_number}`} showBack backTo="/day3/leaderboard">
      {/* Scoreboard */}
      <div className="bg-[hsl(var(--primary))] text-white rounded-2xl p-4 mb-5">
        <div className="grid grid-cols-3 items-center gap-2 text-center">
          <div>
            <p className="text-xs text-green-200 mb-1 truncate">🐗 {match.truffle_player_name}</p>
            <p className="text-4xl font-bold">{truffleHoles}</p>
          </div>
          <div>
            <p className="text-xs text-green-200 mb-1">Holes</p>
            <p className="text-2xl font-bold">{match.holes.length}/18</p>
            {tiedHoles > 0 && <p className="text-xs text-green-200">{tiedHoles} tied</p>}
          </div>
          <div>
            <p className="text-xs text-green-200 mb-1 truncate">🍄 {match.syndicate_player_name}</p>
            <p className="text-4xl font-bold">{syndicateHoles}</p>
          </div>
        </div>
        {match.holes.length === 18 && (
          <div className="mt-3 text-center">
            <p className="text-green-200 text-xs uppercase tracking-wider">Match Complete</p>
            <p className="text-xl font-bold mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
              {truffleHoles > syndicateHoles ? `🐗 ${match.truffle_player_name} wins!` :
               syndicateHoles > truffleHoles ? `🍄 ${match.syndicate_player_name} wins!` :
               "It's a tie!"}
            </p>
          </div>
        )}
      </div>

      {/* Next hole entry */}
      {nextHole <= 18 && (
        <div className="bg-white border border-[hsl(var(--border))] rounded-2xl p-4 mb-5">
          <p className="text-sm font-semibold mb-3 text-center">Hole {nextHole}</p>
          {!canScore && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
              <Lock size={15} className="text-amber-700 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Only {match.truffle_player_name} or {match.syndicate_player_name} (or an admin) can score this match.
              </p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              disabled={saving || !canScore}
              onClick={() => submitHole(nextHole, 'truffle_hogs')}
              className="py-4 rounded-xl font-semibold text-sm bg-[hsl(var(--truffle-light))] text-[hsl(var(--truffle))] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              🐗<br /><span className="text-xs">{match.truffle_player_name.split(' ')[0]}</span>
            </button>
            <button
              disabled={saving || !canScore}
              onClick={() => submitHole(nextHole, 'tie')}
              className="py-4 rounded-xl font-semibold text-sm bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              ✋<br /><span className="text-xs">Tie</span>
            </button>
            <button
              disabled={saving || !canScore}
              onClick={() => submitHole(nextHole, 'mycelium_syndicate')}
              className="py-4 rounded-xl font-semibold text-sm bg-[hsl(var(--syndicate-light))] text-[hsl(var(--syndicate))] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              🍄<br /><span className="text-xs">{match.syndicate_player_name.split(' ')[0]}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hole history */}
      <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Hole History</h3>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 18 }, (_, i) => {
          const hole = i + 1;
          const winner = submitted.get(hole);
          return (
            <div
              key={hole}
              className={cn(
                "relative rounded-lg p-1.5 text-center text-xs font-bold",
                winner === 'truffle_hogs' ? "bg-[hsl(var(--truffle-light))] text-[hsl(var(--truffle))]" :
                winner === 'mycelium_syndicate' ? "bg-[hsl(var(--syndicate-light))] text-[hsl(var(--syndicate))]" :
                winner === 'tie' ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]" :
                "bg-[hsl(var(--border)/0.3)] text-[hsl(var(--border))]"
              )}
            >
              <span className="block text-[10px] leading-none mb-0.5">{hole}</span>
              <span>
                {winner === 'truffle_hogs' ? '🐗' :
                 winner === 'mycelium_syndicate' ? '🍄' :
                 winner === 'tie' ? '✋' : '·'}
              </span>
              {winner && canScore && (
                <button
                  onClick={() => undoHole(hole)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 text-white rounded-full text-[8px] flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
