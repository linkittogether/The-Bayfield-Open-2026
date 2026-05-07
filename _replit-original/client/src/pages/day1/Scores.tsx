import { useState } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Check, Minus, Plus, LogIn, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function Day1Scores() {
  const { user, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { data: players, loading: pLoading } = useApi(() => api.getPlayers(), []);
  const { data: scores, refetch: refetchScores } = useApi(() => api.getDay1Scores(), []);

  // Admins can pick any player; logged-in players are locked to themselves
  const lockedPlayerId = user?.type === 'player' ? user.id : null;
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(lockedPlayerId);
  const [gross, setGross] = useState(36);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submittedIds = new Set(scores?.map(s => s.player_id) || []);
  const player = players?.find(p => p.id === selectedPlayer);
  const netPreview = player ? gross - Math.floor(player.handicap / 2) : null;

  const handleSubmit = async () => {
    if (!selectedPlayer) { setError('Select a player'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.submitDay1Score({ player_id: selectedPlayer, gross_score: gross });
      await refetchScores();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (!lockedPlayerId) setSelectedPlayer(null);
        setGross(36);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  // Not logged in
  if (!user) {
    return (
      <Layout title="Day 1 — Enter Score" showBack backTo="/day1/leaderboard">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <Lock size={40} className="text-[hsl(var(--muted-foreground))]" />
          <div>
            <p className="font-semibold text-lg">Login Required</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              You need to log in to enter your score.
            </p>
          </div>
          <button
            onClick={() => setLocation('/login')}
            className="flex items-center gap-2 px-6 py-3 bg-[hsl(var(--primary))] text-white rounded-xl font-semibold"
          >
            <LogIn size={18} /> Log In
          </button>
        </div>
      </Layout>
    );
  }

  if (pLoading) return (
    <Layout title="Day 1 Scores" showBack>
      <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
    </Layout>
  );

  return (
    <Layout title="Day 1 — Enter Score" showBack backTo="/day1/leaderboard">
      <div className="space-y-5">
        {/* Player select — admins see all players, players just see themselves */}
        {lockedPlayerId ? (
          <div>
            <label className="block text-sm font-semibold mb-2">Entering score for</label>
            {(() => {
              const p = players?.find(pl => pl.id === lockedPlayerId);
              return p ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]">
                  <PlayerAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">HCP {p.handicap}</p>
                  </div>
                  {submittedIds.has(p.id) && <Check size={16} className="text-green-500 flex-shrink-0" />}
                </div>
              ) : (
                <p className="text-sm text-amber-600">Player not found in tournament. Ask an admin.</p>
              );
            })()}
            {submittedIds.has(lockedPlayerId) && (
              <p className="text-sm text-green-600 mt-2 text-center">
                ✓ Your score has already been submitted.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-semibold mb-2">Select Player</label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {players?.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPlayer(p.id); setError(null); }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                    selectedPlayer === p.id
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
                      : "border-[hsl(var(--border))] bg-white",
                    submittedIds.has(p.id) && "opacity-60"
                  )}
                >
                  <PlayerAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">HCP {p.handicap}</p>
                  </div>
                  {submittedIds.has(p.id) && <Check size={16} className="text-green-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Gross score input */}
        {selectedPlayer && (
          <div>
            <label className="block text-sm font-semibold mb-2">Gross Score (9 holes)</label>
            <div className="flex items-center gap-4 bg-white border border-[hsl(var(--border))] rounded-xl p-2">
              <button type="button" onClick={() => setGross(g => Math.max(9, g - 1))}
                className="w-12 h-12 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center active:scale-95">
                <Minus size={20} />
              </button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-bold">{gross}</span>
              </div>
              <button type="button" onClick={() => setGross(g => Math.min(99, g + 1))}
                className="w-12 h-12 rounded-lg bg-[hsl(var(--primary))] text-white flex items-center justify-center active:scale-95">
                <Plus size={20} />
              </button>
            </div>
            {netPreview !== null && (
              <div className="mt-2 text-center">
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  Net score: <strong className="text-[hsl(var(--foreground))]">{netPreview}</strong>
                  <span className="ml-1 text-xs">(HCP {player?.handicap} ÷ 2 = {Math.floor((player?.handicap || 0) / 2)})</span>
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedPlayer || submitting || success}
          className={cn(
            "w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2",
            success ? "bg-green-500 text-white" : "bg-[hsl(var(--primary))] text-white disabled:opacity-40"
          )}
        >
          {success ? <><Check size={20} /> Score Saved!</> :
           submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
           isAdmin ? 'Submit Score (Admin)' : 'Submit My Score'}
        </button>
      </div>
    </Layout>
  );
}
