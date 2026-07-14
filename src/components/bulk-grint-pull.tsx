"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bulkPullDay,
  type BulkPullSummary,
  type BulkPullPlayerStatus,
} from "@/lib/server/grint-import-actions";

const DOT: Record<BulkPullPlayerStatus, string> = {
  pulled: "bg-green-500",
  partial: "bg-amber-500",
  ambiguous: "bg-amber-500",
  none: "bg-muted-foreground/40",
  "no-grint": "bg-muted-foreground/40",
};

/**
 * Admin-only: pull every rostered player's Grint round(s) for this day and write
 * the grosses in one go. Unmatched players are listed so they can be done by hand.
 */
export function BulkGrintPull({ day }: { day: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<BulkPullSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function run() {
    setError(null);
    start(async () => {
      try {
        const res = await bulkPullDay(day);
        setSummary(res);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Pull failed");
      }
    });
  }

  return (
    <div className="bg-accent border border-secondary/40 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm">Admin · Pull all from The Grint</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fetches every player&apos;s matching round for Day {day} and fills in
            the grosses. You review the leaderboard after.
          </p>
        </div>
      </div>

      {pending ? (
        <button
          type="button"
          disabled
          className="w-full h-10 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 opacity-60"
        >
          <Download size={15} />
          Pulling from The Grint…
        </button>
      ) : confirming ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            This overwrites every player&apos;s Day {day} gross with their Grint
            round. Continue?
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
              <Download size={15} />
              Yes, pull all
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full h-10 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-95"
        >
          <Download size={15} />
          {`Pull all — Day ${day}`}
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
            Wrote {summary.written} score{summary.written === 1 ? "" : "s"}
            {summary.segments.length > 1 ? ` across ${summary.segments.length} rounds` : ""}.
          </p>
          <ul className="space-y-1">
            {summary.perPlayer.map((p) => (
              <li key={p.name} className="flex items-center gap-2 text-xs">
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", DOT[p.status])} />
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
