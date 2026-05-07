import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Minus, Plus, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function Day2Scores() {
  const { data: teams, loading } = useApi(() => api.getDay2Teams(), []);
  const { data: lb, refetch } = useApi(() => api.getDay2Leaderboard(), []);
  const { user, isAdmin } = useAuth();

  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [round, setRound] = useState<1 | 2 | 3>(1);
  const [p1Gross, setP1Gross] = useState(36);
  const [p2Gross, setP2Gross] = useState(36);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.type === 'player' ? user.id : null;

  // Find the logged-in player's team
  const myTeam = userId && teams
    ? teams.find(t => t.player1_id === userId || t.player2_id === userId) ?? null
    : null;

  // Auto-select the player's own team; admins see all
  useEffect(() => {
    if (myTeam && !isAdmin) {
      setSelectedTeam(myTeam.id);
    }
  }, [myTeam?.id, isAdmin]);

  // Teams visible in the list
  const visibleTeams = isAdmin ? (teams ?? []) : (myTeam ? [myTeam] : []);

  const team = teams?.find(t => t.id === selectedTeam);
  const teamLb = lb?.find(t => t.team_id === selectedTeam);
  const p1Net = team ? p1Gross - Math.floor(team.player1_handicap / 2) : 0;
  const p2Net = team ? p2Gross - Math.floor(team.player2_handicap / 2) : 0;

  const roundsSubmitted = (teamId: number) => {
    const entry = lb?.find(t => t.team_id === teamId);
    return parseInt(String(entry?.rounds_complete || 0));
  };

  // Is the logged-in user allowed to submit for the selected team?
  const canSubmit = isAdmin || (
    !!team && !!userId &&
    (team.player1_id === userId || team.player2_id === userId)
  );

  const handleSubmit = async () => {
    if (!selectedTeam) { setError('Select a team'); return; }
    if (!canSubmit) { setError('You can only submit scores for your own team.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.submitDay2Score({
        team_id: selectedTeam,
        round_number: round,
        player1_gross: p1Gross,
        player2_gross: p2Gross,
        is_admin: isAdmin,
        auth_player_id: userId ?? undefined,
        auth_pin: user?.pin,
      });
      await refetch();
      setSuccess(true);
      setTimeout(() => { setSuccess(false); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <Layout title="Day 2 Scores" showBack backTo="/day2/leaderboard">
      <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
    </Layout>
  );

  // Not logged in or player with no team yet
  const notLoggedIn = !user;
  const noTeamFound = user?.type === 'player' && !myTeam && teams && teams.length > 0;

  return (
    <Layout title="Day 2 — Enter Score" showBack backTo="/day2/leaderboard">
      <div className="space-y-5">

        {notLoggedIn && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
            <Lock size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">Please log in to enter your Day 2 score.</p>
          </div>
        )}

        {noTeamFound && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
            <Lock size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">You don't have a Day 2 team yet. Partner selection must be completed first.</p>
          </div>
        )}

        {/* Team select — admins see all; players see only their own */}
        {visibleTeams.length > 0 && (
          <div>
            <label className="block text-sm font-semibold mb-2">
              {isAdmin ? 'Select Team' : 'Your Team'}
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {visibleTeams.map(t => {
                const done = roundsSubmitted(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => isAdmin ? (setSelectedTeam(t.id), setError(null)) : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      selectedTeam === t.id
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
                        : "border-[hsl(var(--border))] bg-white",
                      !isAdmin && "cursor-default"
                    )}
                  >
                    <div className="flex -space-x-2">
                      <PlayerAvatar name={t.player1_name} photoUrl={t.player1_photo} size="sm" />
                      <PlayerAvatar name={t.player2_name} photoUrl={t.player2_photo} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.player1_name} & {t.player2_name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        HCP {t.player1_handicap}/{t.player2_handicap} · {done}/3 rounds done
                      </p>
                    </div>
                    {done === 3 && <Check size={16} className="text-green-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Round selector */}
        {selectedTeam && canSubmit && (
          <>
            <div>
              <label className="block text-sm font-semibold mb-2">Round</label>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map(r => {
                  const submitted = teamLb?.round_scores?.find((rs: any) => rs.round === r);
                  return (
                    <button
                      key={r}
                      onClick={() => setRound(r)}
                      className={cn(
                        "py-3 rounded-xl text-sm font-semibold border transition-all",
                        round === r
                          ? "bg-[hsl(var(--primary))] text-white border-transparent"
                          : "bg-white border-[hsl(var(--border))]"
                      )}
                    >
                      Round {r}
                      {submitted && <span className="block text-xs opacity-70">({submitted.net_score})</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Player scores */}
            {team && (
              <div className="space-y-3">
                <ScoreInput
                  label={`${team.player1_name} (HCP ${team.player1_handicap})`}
                  photo={team.player1_photo}
                  value={p1Gross}
                  onChange={setP1Gross}
                  net={p1Net}
                />
                <ScoreInput
                  label={`${team.player2_name} (HCP ${team.player2_handicap})`}
                  photo={team.player2_photo}
                  value={p2Gross}
                  onChange={setP2Gross}
                  net={p2Net}
                />
                <div className="bg-[hsl(var(--muted))] rounded-xl p-3 text-center">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Combined Net Score (Round {round})</p>
                  <p className="text-3xl font-bold">{p1Net + p2Net}</p>
                </div>
              </div>
            )}
          </>
        )}

        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">{error}</div>}

        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={!selectedTeam || submitting || success}
            className={cn(
              "w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2",
              success ? "bg-green-500 text-white" : "bg-[hsl(var(--primary))] text-white disabled:opacity-40"
            )}
          >
            {success ? <><Check size={20} /> Score Saved!</> :
             submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
             'Submit Round Score'}
          </button>
        )}
      </div>
    </Layout>
  );
}

function ScoreInput({ label, photo, value, onChange, net }: {
  label: string; photo: string | null; value: number;
  onChange: (v: number) => void; net: number;
}) {
  return (
    <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-3">
      <p className="text-sm font-medium mb-2 truncate">{label}</p>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(9, value - 1))}
          className="w-10 h-10 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center active:scale-95">
          <Minus size={16} />
        </button>
        <span className="flex-1 text-center text-2xl font-bold">{value}</span>
        <button onClick={() => onChange(Math.min(99, value + 1))}
          className="w-10 h-10 rounded-lg bg-[hsl(var(--primary))] text-white flex items-center justify-center active:scale-95">
          <Plus size={16} />
        </button>
        <div className="text-right w-16">
          <span className="text-lg font-bold">{net}</span>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">net</p>
        </div>
      </div>
    </div>
  );
}
