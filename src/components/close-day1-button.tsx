"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import { completeDay1 } from "@/lib/server/day1";

/**
 * Home-tile action: close Day 1 scoring (one-way) and open partner picking.
 * Styled for the urgent (primary-background) next-step tile.
 */
export function CloseDay1Button() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      try {
        await completeDay1();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to close Day 1");
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
            <Check size={16} /> {pending ? "Closing…" : "Yes, close & start picks"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95"
        >
          <Lock size={15} /> Close scoring &amp; start picks
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
