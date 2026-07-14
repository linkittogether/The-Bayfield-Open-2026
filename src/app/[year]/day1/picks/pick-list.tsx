"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatNet } from "@/lib/format";
import { cn } from "@/lib/utils";
import { submitDay1Pick } from "@/lib/server/day1";

export interface PickCandidate {
  id: number;
  name: string;
  photoUrl: string | null;
  rank: number;
  netScore: number;
  handicap: number;
}

/**
 * Two-step partner pick: tap a player to SELECT (highlight), then confirm in the
 * sticky bar. Prevents an accidental tap from locking in the wrong partner.
 */
export function PickList({
  pickerId,
  pickerName,
  candidates,
  canPick,
}: {
  pickerId: number;
  pickerName: string;
  candidates: PickCandidate[];
  canPick: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  function confirm() {
    if (selectedId == null) return;
    start(async () => {
      try {
        await submitDay1Pick({ pickerPlayerId: pickerId, pickedPlayerId: selectedId });
        setSelectedId(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to make pick");
      }
    });
  }

  return (
    <div className="space-y-2">
      {candidates.map((c) => {
        const isSel = selectedId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            disabled={!canPick || pending}
            onClick={() => setSelectedId((prev) => (prev === c.id ? null : c.id))}
            className={cn(
              "w-full rounded-xl border p-3 flex items-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
              isSel
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "bg-white border-border active:scale-[0.97]",
            )}
          >
            <PlayerAvatar name={c.name} photoUrl={c.photoUrl} size="sm" />
            <div className="flex-1 text-left min-w-0">
              <p className="font-semibold text-sm truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                Rank #{c.rank} · Net {formatNet(c.netScore)} · HCP {c.handicap}
              </p>
            </div>
            {isSel ? (
              <Check size={18} className="text-primary flex-shrink-0" />
            ) : (
              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
            )}
          </button>
        );
      })}

      {selected && canPick && (
        <div className="sticky bottom-3 mt-3 bg-primary text-white rounded-xl p-3 flex items-center gap-2 shadow-lg">
          <p className="flex-1 min-w-0 text-sm">
            Pick <span className="font-bold">{selected.name}</span> as {pickerName}&apos;s
            partner?
          </p>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            disabled={pending}
            className="px-3 h-9 rounded-lg bg-white/15 text-white text-sm font-semibold flex-shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="px-3 h-9 rounded-lg bg-white text-primary text-sm font-semibold flex items-center gap-1 flex-shrink-0 disabled:opacity-60"
          >
            <Check size={15} /> {pending ? "Picking…" : "Confirm"}
          </button>
        </div>
      )}
    </div>
  );
}
