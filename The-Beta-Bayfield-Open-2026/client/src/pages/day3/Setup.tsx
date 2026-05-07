import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Trophy, Check, Shuffle, Lock, Shield } from 'lucide-react';

export function Day3Setup() {
  const [, setLocation] = useLocation();
  const { user, isAdmin } = useAuth();
  const { data: teams, loading } = useApi(() => api.getDay3Teams(), []);
  const [matches, setMatches] = useState<{ truffle_player_id: number; syndicate_player_id: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const truffle = teams?.truffle_hogs || [];
  const syndicate = teams?.mycelium_syndicate || [];

  useEffect(() => {
    if (truffle.length > 0 && syndicate.length > 0 && matches.length === 0) {
      setMatches(truffle.map((t, i) => ({
        truffle_player_id: t.player_id,
        syndicate_player_id: syndicate[i]?.player_id || 0,
      })));
    }
  }, [truffle, syndicate]);

  const updateMatch = (idx: number, field: 'truffle_player_id' | 'syndicate_player_id', playerId: number) => {
    setMatches(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: playerId };
      return updated;
    });
  };

  const randomize = () => {
    const syndicateShuffled = [...syndicate].sort(() => Math.random() - 0.5);
    setMatches(truffle.map((t, i) => ({
      truffle_player_id: t.player_id,
      syndicate_player_id: syndicateShuffled[i]?.player_id || 0,
    })));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = matches.map((m, i) => ({
        match_number: i + 1,
        truffle_player_id: m.truffle_player_id,
        syndicate_player_id: m.syndicate_player_id,
      }));
      await api.createMatches(payload);
      setSaved(true);
      setTimeout(() => setLocation('/day3/leaderboard'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save matches');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <Layout title="Match Setup" showBack backTo="/day3/leaderboard">
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  const userId = user?.type === 'player' ? user.id : null;
  const allPlayers = [...truffle, ...syndicate];
  const isCaptain = userId && allPlayers.some(p => p.player_id === userId && p.is_captain);
  const canSetup = isAdmin || isCaptain;

  if (!canSetup) {
    return (
      <Layout title="Match Setup" showBack backTo="/day3/leaderboard">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <Shield size={40} className="text-[hsl(var(--muted-foreground))]" />
          <div>
            <p className="font-semibold text-lg">Captains Only</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Only Adison E and Josh W (or admins) can set up the Day 3 match pairings.
              {!user && ' Please log in.'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Match Setup" showBack backTo="/day3/leaderboard">
      {/* Intro */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[hsl(var(--truffle-light))] rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-[hsl(var(--truffle))]">🐗 Truffle Hogs</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{truffle.length} players</p>
        </div>
        <div className="bg-[hsl(var(--syndicate-light))] rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-[hsl(var(--syndicate))]">🍄 Mycelium Syndicate</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{syndicate.length} players</p>
        </div>
      </div>

      <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3 text-center">
        Captains: pair each Truffle Hog against a Mycelium Syndicate player for all 10 matches.
      </p>

      <button
        onClick={randomize}
        className="w-full mb-4 py-3 border border-dashed border-[hsl(var(--border))] rounded-xl text-sm font-medium flex items-center justify-center gap-2 text-[hsl(var(--muted-foreground))]"
      >
        <Shuffle size={16} /> Randomize Matchups
      </button>

      <div className="space-y-3">
        {matches.map((m, i) => (
          <div key={i} className="bg-white border border-[hsl(var(--border))] rounded-xl p-3">
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Match {i + 1}</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={m.truffle_player_id}
                onChange={e => updateMatch(i, 'truffle_player_id', parseInt(e.target.value))}
                className="text-xs border border-[hsl(var(--truffle-light))] bg-[hsl(var(--truffle-light))] rounded-lg px-2 py-2 w-full text-[hsl(var(--truffle))] font-medium"
              >
                {truffle.map(p => (
                  <option key={p.player_id} value={p.player_id}>{p.name}</option>
                ))}
              </select>
              <select
                value={m.syndicate_player_id}
                onChange={e => updateMatch(i, 'syndicate_player_id', parseInt(e.target.value))}
                className="text-xs border border-[hsl(var(--syndicate-light))] bg-[hsl(var(--syndicate-light))] rounded-lg px-2 py-2 w-full text-[hsl(var(--syndicate))] font-medium"
              >
                {syndicate.map(p => (
                  <option key={p.player_id} value={p.player_id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="mt-3 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">{error}</div>}

      <button
        onClick={save}
        disabled={saving || saved || matches.some(m => !m.truffle_player_id || !m.syndicate_player_id)}
        className={cn(
          "mt-5 w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2",
          saved ? "bg-green-500 text-white" : "bg-[hsl(var(--primary))] text-white disabled:opacity-40"
        )}
      >
        {saved ? <><Check size={20} /> Matches Set!</> :
         saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
         <><Trophy size={18} /> Save Matches &amp; Start Day 3</>}
      </button>
    </Layout>
  );
}
