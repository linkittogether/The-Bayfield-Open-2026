"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Lock, Mail, Pencil, Shield, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";
import { updatePlayer } from "@/lib/server/players";

interface PlayerLite {
  id: number;
  name: string;
  photoUrl: string | null;
  handicap: number;
  pin: string | null;
  email: string | null;
  isAdmin: boolean;
  /** Current season: handicap is manually pinned (protected from Grint pulls). */
  handicapLocked: boolean;
}

export function PlayerEditor({ players }: { players: PlayerLite[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  // Kept as a string so a decimal can be typed freely (e.g. "13." mid-entry).
  const [editHcp, setEditHcp] = useState("0");
  const [editPin, setEditPin] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAdmin, setEditAdmin] = useState(false);
  const [editLock, setEditLock] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(p: PlayerLite) {
    setEditingId(p.id);
    setEditHcp(String(p.handicap));
    setEditPin(p.pin ?? "");
    setEditEmail(p.email ?? "");
    setEditAdmin(p.isAdmin);
    setEditLock(p.handicapLocked);
    setMsg(null);
  }

  // Changing the handicap auto-locks it (so a Grint pull won't revert it).
  // Values carry one decimal of precision, clamped to 0–54.
  function nudgeHcp(delta: number) {
    const clamped = Math.min(54, Math.max(0, (parseFloat(editHcp) || 0) + delta));
    setEditHcp(String(Math.round(clamped * 10) / 10));
    setEditLock(true);
  }

  function typeHcp(raw: string) {
    // Digits + a single decimal point only.
    const cleaned = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    setEditHcp(cleaned);
    setEditLock(true);
  }

  function cancel() {
    setEditingId(null);
    setMsg(null);
  }

  function save(id: number) {
    setMsg(null);
    startTransition(async () => {
      try {
        const update: {
          handicap?: number;
          pin?: string;
          email?: string;
          isAdmin?: boolean;
          handicapLocked?: boolean;
        } = {
          handicap: Math.round((parseFloat(editHcp) || 0) * 10) / 10,
          email: editEmail.trim(),
          isAdmin: editAdmin,
          handicapLocked: editLock,
        };
        if (update.handicap! < 0 || update.handicap! > 54) {
          setMsg("Handicap must be between 0 and 54");
          return;
        }
        if (editPin) {
          if (!/^\d{4}$/.test(editPin)) {
            setMsg("PIN must be 4 digits");
            return;
          }
          update.pin = editPin;
        }
        await updatePlayer(id, update);
        setMsg("Saved!");
        router.refresh();
        setTimeout(() => {
          setEditingId(null);
          setMsg(null);
        }, 1000);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <User size={16} /> Player Management
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Assign each player&apos;s Google email — that&apos;s how they sign in and submit their own scores. Handicaps editable here too.
      </p>
      <div className="space-y-2">
        {players.map((p) => (
          <div key={p.id}>
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-all",
                editingId === p.id ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    HCP {p.handicap}
                    {p.handicapLocked && (
                      <Lock size={10} className="text-primary" aria-label="Handicap locked" />
                    )}
                  </span>
                  <span>·</span>
                  <span
                    className={cn(
                      "flex items-center gap-0.5",
                      p.pin ? "text-green-600" : "text-amber-600",
                    )}
                  >
                    <Lock size={10} />
                    {p.pin ? `PIN ${p.pin}` : "No PIN"}
                  </span>
                  <span>·</span>
                  <span
                    className={cn(
                      "flex items-center gap-0.5",
                      p.email ? "text-green-600" : "text-amber-600",
                    )}
                  >
                    <Mail size={10} />
                    {p.email ? "Email set" : "No email"}
                  </span>
                  {p.isAdmin && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5 text-primary font-medium">
                        <Shield size={10} />
                        Admin
                      </span>
                    </>
                  )}
                </div>
              </div>
              {editingId === p.id ? (
                <button
                  type="button"
                  onClick={cancel}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="p-1.5 rounded-lg text-primary hover:bg-primary/10"
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>

            {editingId === p.id && (
              <div className="mx-2 p-3 bg-muted/50 rounded-b-xl border border-t-0 border-primary space-y-3">
                <div>
                  <Label className="text-xs mb-1 block">Handicap</Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => nudgeHcp(-1)}
                      className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center flex-shrink-0"
                    >
                      –
                    </button>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editHcp}
                      onChange={(e) => typeHcp(e.target.value)}
                      aria-label="Handicap index"
                      className="flex-1 min-w-0 h-9 text-center text-xl font-bold bg-white border border-border rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => nudgeHcp(1)}
                      className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0"
                    >
                      +
                    </button>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editLock}
                      onChange={(e) => setEditLock(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <Lock
                      size={12}
                      className={editLock ? "text-primary" : "text-muted-foreground"}
                    />
                    Lock handicap — skip Grint pulls
                  </label>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">
                    Google email (used to sign in — leave blank to clear)
                  </Label>
                  <Input
                    type="email"
                    inputMode="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Login PIN (4 digits, for players without Google)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="4-digit PIN"
                    className="text-center tracking-widest"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editAdmin}
                    onChange={(e) => setEditAdmin(e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <Shield
                    size={13}
                    className={editAdmin ? "text-primary" : "text-muted-foreground"}
                  />
                  Admin (tournament organizer)
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={cancel} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => save(p.id)}
                    disabled={pending}
                    className="flex-1"
                  >
                    {pending ? (
                      <Spinner />
                    ) : msg === "Saved!" ? (
                      <>
                        <Check size={14} /> Saved!
                      </>
                    ) : (
                      <>
                        <Check size={14} /> Save
                      </>
                    )}
                  </Button>
                </div>
                {msg && msg !== "Saved!" && (
                  <p className="text-xs text-red-600 text-center">{msg}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}
