"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetSeason } from "@/lib/server/tournament";

export function ResetButton({ seasonId }: { seasonId: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setError(null);
    startTransition(async () => {
      try {
        await resetSeason(seasonId);
        setDone(true);
        setConfirm(false);
        router.refresh();
        setTimeout(() => setDone(false), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reset failed");
      }
    });
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Reset Tournament</p>
          <p className="text-sm text-red-600 mt-0.5">
            Deletes all scores, partner pairings, and match-play matchups, and
            resets the tournament to Day 1. Team rosters and players are
            preserved. Cannot be undone.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 mb-3 bg-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {!confirm ? (
        <Button
          onClick={() => setConfirm(true)}
          variant="destructive"
          className="w-full h-11"
        >
          Reset Tournament
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-red-700 font-semibold text-center">
            Are you sure? This cannot be undone!
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirm(false)}
              className="border-red-300 text-red-700 h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={reset}
              disabled={pending || done}
              variant="destructive"
              className="h-11"
            >
              {done ? (
                <>
                  <Check size={16} /> Done
                </>
              ) : pending ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                "Yes, Reset"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
