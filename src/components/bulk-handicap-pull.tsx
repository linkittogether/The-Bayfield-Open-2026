"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bulkPullRosterHandicaps,
  type HandicapPullSummary,
} from "@/lib/server/grint-import-actions";

/**
 * Admin-only: pull fresh handicaps from The Grint for every roster member of
 * the current season and write each to that season's handicap index.
 */
export function BulkHandicapPull() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<HandicapPullSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function run() {
    setError(null);
    start(async () => {
      try {
        const res = await bulkPullRosterHandicaps();
        setSummary(res);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Pull failed");
      }
    });
  }

  return (
    <div className="bg-accent border border-secondary/40 rounded-xl p-4 space-y-3">
      <div className="flex-1">
        <p className="font-semibold text-sm">Admin · Refresh handicaps from The Grint</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pulls the current handicap for every player on this season&apos;s roster
          and updates their season handicap index.
        </p>
      </div>

      {pending ? (
        <button
          type="button"
          disabled
          className="w-full h-10 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 opacity-60"
        >
          <RefreshCw size={15} className="animate-spin" />
          Refreshing handicaps…
        </button>
      ) : confirming ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            This overwrites every rostered player&apos;s handicap for this season
            with their current Grint value. Continue?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-10 rounded-lg border border-border bg-white text-sm font-medium active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                run();
              }}
              className="h-10 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-95"
            >
              <RefreshCw size={15} />
              Yes, refresh all
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full h-10 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-95"
        >
          <RefreshCw size={15} />
          Refresh all handicaps
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {summary && (
        <div className="space-y-1.5">
          {summary.refreshed && (
            <p className="text-xs text-green-700 flex items-center gap-1">
              🔄 Grint login was refreshed automatically.
            </p>
          )}
          <p className="text-xs font-semibold">
            Updated {summary.updated} handicap{summary.updated === 1 ? "" : "s"}.
          </p>
          <ul className="space-y-1">
            {summary.perPlayer.map((p) => (
              <li key={p.name} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    p.status === "updated" ? "bg-green-500" : "bg-muted-foreground/40",
                  )}
                />
                <span className="font-medium w-24 truncate">{p.name}</span>
                <span className="text-muted-foreground truncate">{p.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
