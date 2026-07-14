"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { undoLastDay1Pick } from "@/lib/server/day1";

/**
 * Admin: undo the most recent partner pick (sequential — click again to keep
 * walking back). Confirms first so it isn't triggered accidentally.
 */
export function UndoPickButton({ lastPickLabel }: { lastPickLabel?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run() {
    start(async () => {
      try {
        await undoLastDay1Pick();
        setConfirming(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to undo pick");
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground flex-1 min-w-0">
          Undo {lastPickLabel ?? "the last pick"}?
        </span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="px-2.5 h-8 rounded-lg border border-border text-xs font-medium flex-shrink-0"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="px-2.5 h-8 rounded-lg bg-red-600 text-white text-xs font-semibold flex-shrink-0 disabled:opacity-60"
        >
          {pending ? "Undoing…" : "Undo"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <Undo2 size={14} /> Undo last pick
    </button>
  );
}
