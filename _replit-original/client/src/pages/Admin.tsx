import { useState } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { Player, Admin as AdminType } from '@/lib/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertTriangle, RefreshCw, Check, Shield, Lock, User, Edit2, Plus,
  Trash2, LogIn, ChevronDown, ChevronUp, X, Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Admin() {
  const { user, isAdmin, login } = useAuth();
  const [, setLocation] = useLocation();
  const { data: state, refetch } = useApi(() => api.getTournament(), []);
  const { data: players, refetch: refetchPlayers } = useApi(() => api.getPlayers(), []);
  const { data: admins, refetch: refetchAdmins } = useApi(() => api.getAdmins(), []);

  // Reset
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Edit player
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editHcp, setEditHcp] = useState(0);
  const [editPin, setEditPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // New admin
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newCode, setNewCode] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [addAdminMsg, setAddAdminMsg] = useState<string | null>(null);

  // Not logged in or not admin
  if (!user) {
    return (
      <Layout title="Admin" showBack backTo="/">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <Lock size={40} className="text-[hsl(var(--muted-foreground))]" />
          <div>
            <p className="font-semibold text-lg">Admin Login Required</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">You must be logged in as an admin to access this page.</p>
          </div>
          <button
            onClick={() => setLocation('/login')}
            className="flex items-center gap-2 px-6 py-3 bg-[hsl(var(--primary))] text-white rounded-xl font-semibold"
          >
            <LogIn size={18} /> Go to Login
          </button>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout title="Admin" showBack backTo="/">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <Shield size={40} className="text-[hsl(var(--muted-foreground))]" />
          <div>
            <p className="font-semibold text-lg">Admin Access Only</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">You're logged in as a player. Admin access is required for this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const startEdit = (p: Player) => {
    setEditingId(p.id);
    setEditHcp(p.handicap);
    setEditPin('');
    setSaveMsg(null);
  };

  const cancelEdit = () => { setEditingId(null); setSaveMsg(null); };

  const saveEdit = async (id: number) => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const update: { handicap?: number; pin?: string } = { handicap: editHcp };
      if (editPin.trim()) update.pin = editPin.trim();
      await api.updatePlayer(id, update);
      setSaveMsg('Saved!');
      await refetchPlayers();
      setTimeout(() => { setEditingId(null); setSaveMsg(null); }, 1200);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      await api.resetTournament();
      await refetch();
      setResetDone(true);
      setConfirmReset(false);
      setTimeout(() => setResetDone(false), 2000);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newCode.trim()) return;
    setAddingAdmin(true);
    setAddAdminMsg(null);
    try {
      await api.addAdmin({ username: newUsername.trim(), code: newCode.trim() });
      setAddAdminMsg('Admin added!');
      setNewUsername('');
      setNewCode('');
      await refetchAdmins();
      setTimeout(() => { setShowAddAdmin(false); setAddAdminMsg(null); }, 1500);
    } catch (err) {
      setAddAdminMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setAddingAdmin(false);
    }
  };

  const removeAdmin = async (id: number) => {
    try {
      await api.deleteAdmin(id);
      await refetchAdmins();
    } catch {}
  };

  return (
    <Layout title="Admin Panel" showBack backTo="/">
      <div className="space-y-5">

        {/* Admin badge */}
        <div className="flex items-center gap-2 bg-[hsl(var(--primary)/0.08)] rounded-xl px-4 py-3">
          <Shield size={18} className="text-[hsl(var(--primary))]" />
          <span className="text-sm font-semibold text-[hsl(var(--primary))]">Logged in as admin: {user.name}</span>
        </div>

        {/* Tournament Status */}
        <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-4">
          <h3 className="font-semibold mb-3">Tournament Status</h3>
          <div className="space-y-2 text-sm">
            <StatusRow label="Players registered" value={players?.length || 0} />
            <StatusRow label="Current day" value={state?.current_day || 1} />
            <StatusRow label="Day 1 complete" value={state?.day1_complete ? 'Yes' : 'No'} />
            <StatusRow label="Partners picked" value={state?.day1_picking_complete ? 'Yes' : 'No'} />
            <StatusRow label="Day 2 complete" value={state?.day2_complete ? 'Yes' : 'No'} />
            <StatusRow label="Day 3 draft complete" value={state?.day2_draft_complete ? 'Yes' : 'No'} />
            <StatusRow label="Day 3 complete" value={state?.day3_complete ? 'Yes' : 'No'} />
          </div>
        </div>

        {/* Player Management */}
        <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <User size={16} />
            Player Management
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
            Edit handicaps and set PINs for any player. Players use their PIN to log in and submit their own scores.
          </p>
          <div className="space-y-2">
            {players?.map(p => (
              <div key={p.id}>
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all",
                  editingId === p.id
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.03)]"
                    : "border-[hsl(var(--border))]"
                )}>
                  <PlayerAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <span>HCP {p.handicap}</span>
                      <span>·</span>
                      <span className={cn("flex items-center gap-0.5", (p as any).has_pin ? "text-green-600" : "text-amber-600")}>
                        <Lock size={10} />
                        {(p as any).has_pin ? 'PIN set' : 'No PIN'}
                      </span>
                    </div>
                  </div>
                  {editingId === p.id ? (
                    <button onClick={cancelEdit} className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">
                      <X size={16} />
                    </button>
                  ) : (
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)]">
                      <Pencil size={16} />
                    </button>
                  )}
                </div>

                {editingId === p.id && (
                  <div className="mx-2 p-3 bg-[hsl(var(--muted)/0.5)] rounded-b-xl border border-t-0 border-[hsl(var(--primary))] space-y-3">
                    <div>
                      <label className="text-xs font-semibold mb-1 block">Handicap</label>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setEditHcp(h => Math.max(0, h - 1))}
                          className="w-9 h-9 rounded-lg bg-white border border-[hsl(var(--border))] flex items-center justify-center">
                          –
                        </button>
                        <span className="flex-1 text-center text-xl font-bold">{editHcp}</span>
                        <button type="button" onClick={() => setEditHcp(h => Math.min(54, h + 1))}
                          className="w-9 h-9 rounded-lg bg-[hsl(var(--primary))] text-white flex items-center justify-center">
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block">Set / Change PIN (leave blank to keep current)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={editPin}
                        onChange={e => setEditPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="New PIN (4 digits)"
                        className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-white text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={cancelEdit} className="flex-1 py-2 rounded-lg border border-[hsl(var(--border))] text-sm font-semibold">
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(p.id)}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                      >
                        {saving
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : saveMsg === 'Saved!' ? <><Check size={14} /> Saved!</>
                          : <><Check size={14} /> Save</>
                        }
                      </button>
                    </div>
                    {saveMsg && saveMsg !== 'Saved!' && (
                      <p className="text-xs text-red-600 text-center">{saveMsg}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Admin Management */}
        <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Shield size={16} />
              Admins
            </h3>
            <button
              onClick={() => setShowAddAdmin(v => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))] px-2 py-1 rounded-lg hover:bg-[hsl(var(--primary)/0.08)]"
            >
              <Plus size={14} /> Add Admin
            </button>
          </div>

          {showAddAdmin && (
            <form onSubmit={addAdmin} className="mb-3 p-3 bg-[hsl(var(--muted)/0.5)] rounded-xl space-y-2">
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Username"
                autoCapitalize="none"
                className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              />
              <input
                type="password"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="Access code"
                className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              />
              {addAdminMsg && (
                <p className={cn("text-xs text-center", addAdminMsg === 'Admin added!' ? "text-green-600" : "text-red-600")}>
                  {addAdminMsg}
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddAdmin(false)} className="flex-1 py-2 rounded-lg border border-[hsl(var(--border))] text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={addingAdmin} className="flex-1 py-2 rounded-lg bg-[hsl(var(--primary))] text-white text-xs font-semibold">
                  {addingAdmin ? 'Adding…' : 'Add Admin'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {admins?.map(a => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[hsl(var(--muted)/0.4)]">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-[hsl(var(--primary))]" />
                  <span className="text-sm font-medium">{a.username}</span>
                </div>
                {a.username !== 'admin' && (
                  <button onClick={() => removeAdmin(a.id)} className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Reset */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Reset Tournament</p>
              <p className="text-sm text-red-600 mt-0.5">Deletes ALL data including players, scores, and teams. Cannot be undone.</p>
            </div>
          </div>

          {resetError && <p className="text-sm text-red-700 mb-3 bg-red-100 rounded-lg px-3 py-2">{resetError}</p>}

          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold text-sm"
            >
              Reset Tournament
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-700 font-semibold text-center">Are you sure? This cannot be undone!</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmReset(false)} className="py-3 border border-red-300 rounded-xl text-sm font-semibold text-red-700">
                  Cancel
                </button>
                <button
                  onClick={doReset}
                  disabled={resetting || resetDone}
                  className="py-3 bg-red-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {resetDone ? <><Check size={16} /> Done</> :
                   resetting ? <RefreshCw size={16} className="animate-spin" /> :
                   'Yes, Reset'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatusRow({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-[hsl(var(--border))] last:border-0">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-medium">{String(value)}</span>
    </div>
  );
}
