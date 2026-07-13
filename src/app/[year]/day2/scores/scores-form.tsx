"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PlayerAvatar } from "@/components/player-avatar";
import { GrintPullButton } from "@/components/grint-pull-button";
import { cn } from "@/lib/utils";
import { netForSegment } from "@/lib/handicap";
import { formatNet } from "@/lib/format";
import { submitSegmentScore } from "@/lib/server/day2";

export interface SegmentLite {
  id: number;
  label: string;
  holes: number;
  rating: number | null;
  slope: number | null;
  par: number | null;
}
export interface PlayerLite {
  id: number;
  name: string;
  photoUrl: string | null;
  index: number;
}
export interface ScoreLite {
  segmentId: number;
  playerId: number;
  gross: number;
}

export function Day2ScoresForm({
  segments,
  players,
  scores,
  userId,
  isAdmin,
}: {
  segments: SegmentLite[];
  players: PlayerLite[];
  scores: ScoreLite[];
  userId: number | null;
  isAdmin: boolean;
}) {
  const lockedId = !isAdmin ? userId : null;
  const [selectedId, setSelectedId] = useState<number | null>(lockedId);
  const player = players.find((p) => p.id === selectedId);
  const grossFor = (segmentId: number, playerId: number) =>
    scores.find((s) => s.segmentId === segmentId && s.playerId === playerId)?.gross ?? null;

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div>
          <Label className="block mb-2">Select Player</Label>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  selectedId === p.id ? "border-primary bg-primary/5" : "border-border bg-white",
                )}
              >
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                <p className="flex-1 min-w-0 font-medium text-sm truncate">{p.name}</p>
                <span className="text-xs text-muted-foreground">Index {p.index}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {segments.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No Saturday rounds are configured for this season yet.
        </p>
      )}

      {player &&
        segments.map((seg) => (
          <SegmentEntry
            key={`${player.id}-${seg.id}`}
            segment={seg}
            player={player}
            existingGross={grossFor(seg.id, player.id)}
          />
        ))}
    </div>
  );
}

function SegmentEntry({
  segment,
  player,
  existingGross,
}: {
  segment: SegmentLite;
  player: PlayerLite;
  existingGross: number | null;
}) {
  const router = useRouter();
  const defaultGross = segment.holes === 18 ? 72 : 36;
  const [gross, setGross] = useState(existingGross ?? defaultGross);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const net = netForSegment(gross, player.index, {
    rating: segment.rating,
    slope: segment.slope,
    par: segment.par,
    holes: segment.holes as 9 | 18,
  });

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitSegmentScore({
          playerId: player.id,
          segmentId: segment.id,
          grossScore: gross,
        });
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submit failed");
      }
    });
  }

  return (
    <div className="bg-white border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {segment.label} ({segment.holes} holes)
        </p>
        {existingGross != null && <Check size={14} className="text-green-500" />}
      </div>
      <GrintPullButton segmentId={segment.id} playerId={player.id} onPulled={setGross} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setGross((g) => Math.max(segment.holes === 18 ? 18 : 9, g - 1))}
          className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center active:scale-95"
        >
          <Minus size={16} />
        </button>
        <span className="flex-1 text-center text-2xl font-bold">{gross}</span>
        <button
          type="button"
          onClick={() => setGross((g) => Math.min(199, g + 1))}
          className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center active:scale-95"
        >
          <Plus size={16} />
        </button>
        <div className="text-right w-14">
          <span className="text-lg font-bold">{formatNet(net)}</span>
          <p className="text-xs text-muted-foreground">net</p>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button
        onClick={submit}
        disabled={pending || success}
        className={cn("w-full h-10", success && "bg-green-500 hover:bg-green-500")}
      >
        {success ? "Saved!" : pending ? "Saving…" : existingGross != null ? "Update" : "Save"}
      </Button>
    </div>
  );
}
