"use client";

import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completePartnerDraft } from "@/lib/server/day1";

/**
 * Home-tile action: lock the partner draft once all pairs are made. Picking no
 * longer auto-locks (see submitDay1Pick), so an admin confirms the pairs here.
 * Styled for the urgent (primary-background) next-step tile.
 */
export function LockDraftButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      try {
        await completePartnerDraft();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to lock the draft");
      }
    });
  }

  return (
    <div className="mt-3">
      {confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-11 rounded-xl border border-border bg-white text-foreground font-semibold text-sm active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="h-11 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60"
          >
            <Check size={16} /> {pending ? "Locking…" : "Yes, lock the pairs"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95"
        >
          <Lock size={15} /> Lock the partner draft
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
