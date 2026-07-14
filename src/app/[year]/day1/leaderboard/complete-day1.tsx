"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeDay1 } from "@/lib/server/day1";

/**
 * Admin control to close Day 1 scoring and open partner picking. Until this is
 * pressed, `day1Complete` stays false and the home "next step" stays on scoring.
 */
export function CompleteDay1({ scored, total }: { scored: number; total: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = total - scored;

  function run() {
    setError(null);
    start(async () => {
      try {
        await completeDay1();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="mt-5 bg-accent rounded-2xl p-4 border border-secondary/30">
      <p className="font-semibold text-sm mb-1">Close Day 1 scoring?</p>
      <p className="text-xs text-muted-foreground mb-3">
        {scored} of {total} players scored
        {missing > 0 ? ` — ${missing} still missing a score.` : " — everyone's in."}{" "}
        This locks the standings and starts partner picking (10th place picks first).
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setConfirming(false)} className="h-11">
            Cancel
          </Button>
          <Button
            onClick={run}
            disabled={pending}
            className="h-11 bg-secondary text-white hover:bg-secondary/90"
          >
            <Check size={16} /> {pending ? "Closing…" : "Confirm"}
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => setConfirming(true)}
          className="w-full bg-secondary text-white hover:bg-secondary/90"
        >
          <Users size={16} /> Complete Day 1 &amp; start picks
        </Button>
      )}
    </div>
  );
}
