"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";
import { netForSegment } from "@/lib/handicap";
import { formatNet } from "@/lib/format";
import { submitDay1Score } from "@/lib/server/day1";

interface PlayerLite {
  id: number;
  name: string;
  photoUrl: string | null;
  index: number;
}

interface SegmentLite {
  rating: number | null;
  slope: number | null;
  par: number | null;
  holes: number;
}

export function ScoresForm({
  players,
  segment,
  submittedIds,
  lockedPlayerId,
  isAdmin,
}: {
  players: PlayerLite[];
  segment: SegmentLite | null;
  submittedIds: number[];
  lockedPlayerId: number | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const submitted = new Set(submittedIds);
  const [selected, setSelected] = useState<number | null>(lockedPlayerId);
  const [gross, setGross] = useState(36);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const player = players.find((p) => p.id === selected);
  const netPreview =
    player && segment
      ? netForSegment(gross, player.index, {
          rating: segment.rating,
          slope: segment.slope,
          par: segment.par,
          holes: segment.holes as 9 | 18,
        })
      : null;

  function submit() {
    if (!selected) return setError("Select a player");
    setError(null);
    startTransition(async () => {
      try {
        await submitDay1Score({ playerId: selected, grossScore: gross });
        setSuccess(true);
        router.refresh();
        setTimeout(() => {
          setSuccess(false);
          if (!lockedPlayerId) setSelected(null);
          setGross(36);
        }, 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit");
      }
    });
  }

  return (
    <div className="space-y-5">
      {lockedPlayerId ? (
        <div>
          <Label className="block mb-2">Entering score for</Label>
          {(() => {
            const me = players.find((p) => p.id === lockedPlayerId);
            return me ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-primary bg-primary/5">
                <PlayerAvatar name={me.name} photoUrl={me.photoUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{me.name}</p>
                  <p className="text-xs text-muted-foreground">Index {me.index}</p>
                </div>
                {submitted.has(me.id) && <Check size={16} className="text-green-500" />}
              </div>
            ) : (
              <p className="text-sm text-amber-600">Player not found.</p>
            );
          })()}
          {submitted.has(lockedPlayerId) && (
            <p className="text-sm text-green-600 mt-2 text-center">
              ✓ Your score has already been submitted (you can edit it).
            </p>
          )}
        </div>
      ) : (
        <div>
          <Label className="block mb-2">Select Player</Label>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelected(p.id);
                  setError(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  selected === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-white",
                  submitted.has(p.id) && "opacity-60",
                )}
              >
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Index {p.index}</p>
                </div>
                {submitted.has(p.id) && <Check size={16} className="text-green-500" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div>
          <Label className="block mb-2">Gross Score (9 holes)</Label>
          <div className="flex items-center gap-4 bg-white border border-border rounded-xl p-2">
            <button
              type="button"
              onClick={() => setGross((g) => Math.max(9, g - 1))}
              className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center active:scale-95"
            >
              <Minus size={20} />
            </button>
            <span className="flex-1 text-center text-3xl font-bold">{gross}</span>
            <button
              type="button"
              onClick={() => setGross((g) => Math.min(99, g + 1))}
              className="w-12 h-12 rounded-lg bg-primary text-white flex items-center justify-center active:scale-95"
            >
              <Plus size={20} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            {netPreview !== null ? (
              <>
                Net score: <strong className="text-foreground">{formatNet(netPreview)}</strong>
              </>
            ) : (
              <>Net will be computed once course data is set for this round.</>
            )}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      <Button
        onClick={submit}
        disabled={!selected || pending || success}
        className={cn(
          "w-full h-12 text-base",
          success && "bg-green-500 hover:bg-green-500",
        )}
      >
        {success ? (
          <>
            <Check size={18} /> Score Saved!
          </>
        ) : pending ? (
          <Spinner />
        ) : isAdmin ? (
          "Submit Score (Admin)"
        ) : (
          "Submit My Score"
        )}
      </Button>
    </div>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}
