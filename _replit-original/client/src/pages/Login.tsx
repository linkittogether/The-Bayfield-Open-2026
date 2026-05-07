import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { LogIn, User, Shield, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'player' | 'admin';

export function Login() {
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>('player');

  // Player login state
  const [players, setPlayers] = useState<Array<{ id: number; name: string; photo_url: string | null; has_pin: boolean }>>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pin, setPin] = useState('');

  // Admin login state
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setLocation('/');
  }, [user]);

  useEffect(() => {
    api.getPlayersForLogin().then(setPlayers).catch(() => {});
  }, []);

  const handlePlayerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) { setError('Please select your name'); return; }
    if (!pin.trim()) { setError('Please enter your PIN'); return; }
    setLoading(true);
    setError(null);
    try {
      const u = await api.playerLogin({ player_id: selectedId, pin: pin.trim() });
      login({ ...u, pin: pin.trim() });
      setLocation('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !code.trim()) { setError('Please enter username and code'); return; }
    setLoading(true);
    setError(null);
    try {
      const u = await api.adminLogin({ username: username.trim(), code: code.trim() });
      login(u);
      setLocation('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlayer = players.find(p => p.id === selectedId);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col">
      {/* Header */}
      <header className="bg-[hsl(var(--primary))] text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-center gap-3">
          <img
            src="/logo.png"
            alt="Bayfield Open"
            className="h-16 w-16 object-contain"
            style={{ filter: 'invert(1)' }}
          />
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-green-200 font-medium">Welcome to the</div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>Bayfield Open</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        {/* Tab switcher */}
        <div className="flex bg-[hsl(var(--muted))] rounded-xl p-1 mb-6">
          <button
            onClick={() => { setTab('player'); setError(null); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === 'player'
                ? "bg-white text-[hsl(var(--foreground))] shadow-sm"
                : "text-[hsl(var(--muted-foreground))]"
            )}
          >
            <User size={16} />
            Player Login
          </button>
          <button
            onClick={() => { setTab('admin'); setError(null); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === 'admin'
                ? "bg-white text-[hsl(var(--foreground))] shadow-sm"
                : "text-[hsl(var(--muted-foreground))]"
            )}
          >
            <Shield size={16} />
            Admin Login
          </button>
        </div>

        {tab === 'player' ? (
          <form onSubmit={handlePlayerLogin} className="space-y-4">
            <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-5 space-y-4">
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center">
                Log in to enter your own scores and track your progress.
              </p>

              {/* Player select */}
              <div>
                <label className="block text-sm font-semibold mb-2">Your Name</label>
                <div className="relative">
                  <select
                    value={selectedId ?? ''}
                    onChange={e => { setSelectedId(Number(e.target.value) || null); setError(null); }}
                    className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-[hsl(var(--border))] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  >
                    <option value="">— Select your name —</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{!p.has_pin ? ' (no PIN set)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] pointer-events-none" />
                </div>
                {selectedPlayer && !selectedPlayer.has_pin && (
                  <p className="text-xs text-amber-600 mt-1">
                    This player has no PIN. Ask an admin to set one in the Admin panel.
                  </p>
                )}
              </div>

              {/* PIN */}
              <div>
                <label className="block text-sm font-semibold mb-2">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={10}
                  value={pin}
                  onChange={e => { setPin(e.target.value); setError(null); }}
                  placeholder="Enter your PIN"
                  className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] tracking-widest text-center text-xl"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-base bg-[hsl(var(--primary))] text-white flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><LogIn size={18} /> Log In as Player</>
              }
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-5 space-y-4">
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center">
                Admins can edit scores, handicaps, and manage all tournament settings.
              </p>

              <div>
                <label className="block text-sm font-semibold mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(null); }}
                  placeholder="Admin username"
                  autoCapitalize="none"
                  className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Access Code</label>
                <input
                  type="password"
                  value={code}
                  onChange={e => { setCode(e.target.value); setError(null); }}
                  placeholder="Access code"
                  className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-base bg-[hsl(var(--primary))] text-white flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Shield size={18} /> Log In as Admin</>
              }
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-6">
          No account? Ask the tournament admin to register you.
        </p>
      </div>
    </div>
  );
}
