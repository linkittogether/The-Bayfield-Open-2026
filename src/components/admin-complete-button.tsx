"use client";

import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

/**
 * Admin-only "mark this stage complete" button for the home-page stage cards.
 * Two-tap confirm; calls the passed server action, then refreshes so the card's
 * completion state updates. `indent` matches the ml-8 offset of the sub-cards
 * (Partner Draft / Match Play Draft).
 */
export function AdminCompleteButton({
  action,
  label,
  confirmLabel = "Confirm",
  indent = false,
}: {
  action: () => Promise<unknown>;
  label: string;
  confirmLabel?: string;
  indent?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      try {
        await action();
        setConfirming(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className={cn("mt-2", indent && "ml-8")}>
      {confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-10 rounded-xl bg-muted text-foreground font-semibold text-sm active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="h-10 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60"
          >
            <Check size={16} /> {pending ? "Saving…" : confirmLabel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full h-10 rounded-xl border border-primary/30 bg-primary/5 text-primary font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95"
        >
          <Lock size={14} /> {label}
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
