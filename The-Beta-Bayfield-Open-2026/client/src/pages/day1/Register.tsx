import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { api } from '@/lib/api';
import { Camera, User, Minus, Plus, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function Register() {
  const [, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const [name, setName] = useState('');
  const [handicap, setHandicap] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter a name'); return; }
    if (pin && (pin.length < 4 || !/^\d+$/.test(pin))) {
      setError('PIN must be 4 digits'); return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('handicap', String(handicap));
      if (photo) fd.append('photo', photo);
      if (pin.trim()) fd.append('pin', pin.trim());
      await api.registerPlayer(fd);
      setSuccess(true);
      setTimeout(() => {
        setName('');
        setHandicap(0);
        setPhoto(null);
        setPreview(null);
        setPin('');
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Register Player" showBack backTo="/">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photo upload */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative w-28 h-28 rounded-full bg-[hsl(var(--muted))] border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center overflow-hidden transition-colors hover:bg-[hsl(var(--accent))]"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-[hsl(var(--muted-foreground))]">
                <Camera size={28} />
                <span className="text-xs">Add Photo</span>
              </div>
            )}
            <div className="absolute bottom-1 right-1 bg-[hsl(var(--primary))] text-white rounded-full p-1">
              <Camera size={12} />
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handlePhoto} className="hidden" />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">Optional photo</p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            <User size={14} className="inline mr-1" />
            Player Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full name"
            className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
            data-testid="input-name"
          />
        </div>

        {/* Handicap */}
        <div>
          <label className="block text-sm font-semibold mb-2">Handicap</label>
          <div className="flex items-center gap-4 bg-white border border-[hsl(var(--border))] rounded-xl p-2">
            <button
              type="button"
              onClick={() => setHandicap(h => Math.max(0, h - 1))}
              className="w-11 h-11 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center active:scale-95"
            >
              <Minus size={18} />
            </button>
            <span className="flex-1 text-center text-2xl font-bold">{handicap}</span>
            <button
              type="button"
              onClick={() => setHandicap(h => Math.min(54, h + 1))}
              className="w-11 h-11 rounded-lg bg-[hsl(var(--primary))] text-white flex items-center justify-center active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 text-center">Net score = Gross − ½ Handicap</p>
        </div>

        {/* PIN */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            <Lock size={14} className="inline mr-1" />
            Player PIN {isAdmin ? '(optional, set on behalf of player)' : '(4 digits)'}
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="4-digit PIN"
            className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] tracking-widest text-center text-xl"
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Players use this PIN to log in and enter their own scores. Can be set later by an admin.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || success}
          data-testid="button-submit"
          className={cn(
            "w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2",
            success
              ? "bg-green-500 text-white"
              : "bg-[hsl(var(--primary))] text-white active:scale-[0.98] disabled:opacity-60"
          )}
        >
          {success ? (
            <><Check size={20} /> Registered!</>
          ) : submitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Register Player'
          )}
        </button>

        <button
          type="button"
          onClick={() => setLocation('/day1/leaderboard')}
          className="w-full py-3 text-sm text-[hsl(var(--muted-foreground))] underline"
        >
          View all players →
        </button>
      </form>
    </Layout>
  );
}
