import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ordinal, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Trophy, ChevronRight, Lock } from 'lucide-react';

export function Day1Picks() {
  const { data, loading, refetch } = useApi(() => api.getDay1Picks(), [], 5000);
  const { user, isAdmin, isPlayer } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPickNow = !!data?.nextPicker && (isAdmin || isPlayer(data.nextPicker.id));

  const handlePick = async (pickerPlayerId: number, pickedPlayerId: number) => {
    setSubmitting(true);
    setError(null);
    try {
      await api.makePick({
        picker_player_id: pickerPlayerId,
        picked_player_id: pickedPlayerId,
        is_admin: isAdmin,
        auth_player_id: user?.type === 'player' ? user.id : undefined,
        auth_pin: user?.type === 'player' ? user.pin : undefined,
      });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make pick');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <Layout title="Partner Selection" showBack backTo="/day1/leaderboard">
      <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
    </Layout>
  );

  return (
    <Layout title="Partner Selection" showBack backTo="/day1/leaderboard">
      {data?.pickingComplete ? (
        <>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-5 text-center">
            <Trophy size={36} className="mx-auto mb-2 text-[hsl(var(--gold))]" />
            <p className="font-bold text-green-800 text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>Teams are set!</p>
            <p className="text-sm text-green-700 mt-1">All partners have been selected for Day 2.</p>
          </div>

          <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">Day 2 Teams</h3>
          <div className="space-y-2">
            {data.teams.map((team) => {
              const p1 = data.leaderboard.find(p => p.id === team.player1_id);
              const p2 = data.leaderboard.find(p => p.id === team.player2_id);
              return (
                <div key={team.id} className="bg-white rounded-xl border border-[hsl(var(--border))] p-3 flex items-center gap-3">
                  <Users size={18} className="text-[hsl(var(--primary))] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{p1?.name} <span className="text-[hsl(var(--muted-foreground))]">+</span> {p2?.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Ranks #{p1?.rank} & #{p2?.rank}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Instructions */}
          <div className="bg-[hsl(var(--accent))] border border-[hsl(var(--secondary)/0.3)] rounded-2xl p-4 mb-5">
            <p className="text-sm font-semibold mb-1">How it works</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Starting with the 10th place player, each player picks a partner from the bottom 10. 
              Then 9th, 8th... down to 1st.
            </p>
          </div>

          {/* Current picker */}
          {data?.nextPicker && (
            <div className="mb-5">
              <div className="bg-[hsl(var(--primary))] text-white rounded-2xl p-4 mb-4">
                <p className="text-green-200 text-xs uppercase tracking-wider mb-2">Now Picking</p>
                <div className="flex items-center gap-3">
                  <PlayerAvatar name={data.nextPicker.name} photoUrl={data.nextPicker.photo_url} size="md" />
                  <div>
                    <p className="font-bold text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>{data.nextPicker.name}</p>
                    <p className="text-green-200 text-sm">{ordinal(data.nextPickerRank)} place · Net {data.nextPicker.net_score}</p>
                  </div>
                </div>
              </div>

              {!canPickNow && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
                  <Lock size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    {user?.type === 'player'
                      ? `Only ${data.nextPicker.name} can make this pick. Please hand the device to them, or have an admin sign in.`
                      : 'Sign in as ' + data.nextPicker.name + ' (or as an admin) to make this pick.'}
                  </p>
                </div>
              )}

              <h3 className="text-sm font-semibold mb-2">Available Players (ranks 11–20)</h3>
              <div className="space-y-2">
                {data.available.map(p => (
                  <button
                    key={p.id}
                    disabled={submitting || !canPickNow}
                    onClick={() => handlePick(data.nextPicker!.id, p.id)}
                    className="w-full bg-white rounded-xl border border-[hsl(var(--border))] p-3 flex items-center gap-3 active:scale-[0.97] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    <PlayerAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Rank #{p.rank} · Net {p.net_score} · HCP {p.handicap}</p>
                    </div>
                    <ChevronRight size={16} className="text-[hsl(var(--muted-foreground))]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Teams so far */}
          {data?.teams && data.teams.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2 mt-4">Teams So Far</h3>
              <div className="space-y-2">
                {data.teams.map(team => {
                  const p1 = data.leaderboard.find(p => p.id === team.player1_id);
                  const p2 = data.leaderboard.find(p => p.id === team.player2_id);
                  return (
                    <div key={team.id} className={cn("bg-white rounded-xl border p-3 flex items-center gap-3", "border-[hsl(var(--border))]")}>
                      <Users size={16} className="text-[hsl(var(--primary))]" />
                      <p className="text-sm">{p1?.name} <span className="text-[hsl(var(--muted-foreground))]">+</span> {p2?.name}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {error && (
        <div className="mt-4 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">{error}</div>
      )}
    </Layout>
  );
}
