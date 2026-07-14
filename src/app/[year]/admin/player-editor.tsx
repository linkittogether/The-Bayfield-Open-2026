"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Lock, Mail, Pencil, User, X } from "lucide-react";
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
  hasPin: boolean;
  email: string | null;
}

export function PlayerEditor({ players }: { players: PlayerLite[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editHcp, setEditHcp] = useState(0);
  const [editPin, setEditPin] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(p: PlayerLite) {
    setEditingId(p.id);
    setEditHcp(p.handicap);
    setEditPin("");
    setEditEmail(p.email ?? "");
    setMsg(null);
  }

  function cancel() {
    setEditingId(null);
    setMsg(null);
  }

  function save(id: number) {
    setMsg(null);
    startTransition(async () => {
      try {
        const update: { handicap?: number; pin?: string; email?: string } = {
          handicap: editHcp,
          email: editEmail.trim(),
        };
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
                  <span>HCP {p.handicap}</span>
                  <span>·</span>
                  <span
                    className={cn(
                      "flex items-center gap-0.5",
                      p.hasPin ? "text-green-600" : "text-amber-600",
                    )}
                  >
                    <Lock size={10} />
                    {p.hasPin ? "PIN set" : "No PIN"}
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
                      onClick={() => setEditHcp((h) => Math.max(0, h - 1))}
                      className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center"
                    >
                      –
                    </button>
                    <span className="flex-1 text-center text-xl font-bold">{editHcp}</span>
                    <button
                      type="button"
                      onClick={() => setEditHcp((h) => Math.min(54, h + 1))}
                      className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
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
                  <Label className="text-xs mb-1 block">Set / Change PIN (leave blank to keep current)</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="New PIN (4 digits)"
                    className="text-center tracking-widest"
                  />
                </div>
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
