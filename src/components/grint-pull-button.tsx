"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  previewGrintScoreForSegment,
  type GrintPreview,
} from "@/lib/server/grint-import-actions";

/**
 * "Pull from The Grint" button. On click it previews the player's matching
 * round(s) for one segment and, on a single match, pre-fills the gross via
 * `onPulled` (the user still reviews + Saves through the normal form). Ambiguous
 * matches render a small chooser; everything else shows an inline note.
 */
export function GrintPullButton({
  segmentId,
  playerId,
  onPulled,
}: {
  segmentId: number;
  playerId: number;
  onPulled: (gross: number) => void;
}) {
  const [pulling, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [choices, setChoices] = useState<GrintPreview["candidates"]>([]);

  function describe(c: GrintPreview["candidates"][number]) {
    return `${c.gross} — ${c.teeLabel}, ${c.displayDate}${c.slope ? ` (slope ${c.slope})` : ""}`;
  }

  function accept(c: GrintPreview["candidates"][number]) {
    if (c.gross == null) {
      setMsg({ tone: "warn", text: "That Grint round has no score recorded." });
      return;
    }
    onPulled(c.gross);
    setChoices([]);
    setMsg({ tone: "ok", text: `Pulled ${describe(c)} — review and Save.` });
  }

  function pull() {
    setMsg(null);
    setChoices([]);
    start(async () => {
      try {
        const res = await previewGrintScoreForSegment({ playerId, segmentId });
        switch (res.status) {
          case "matched":
            accept(res.candidates[0]);
            break;
          case "ambiguous":
            setChoices(res.candidates);
            setMsg({ tone: "warn", text: `${res.candidates.length} Grint rounds match — pick one:` });
            break;
          case "none":
            setMsg({ tone: "warn", text: "No matching Grint round found for this day." });
            break;
          case "no-grint":
            setMsg({ tone: "warn", text: "No Grint account is linked to this player." });
            break;
          case "no-course-id":
            setMsg({ tone: "warn", text: "This course isn't mapped to The Grint yet." });
            break;
        }
      } catch (e) {
        setMsg({ tone: "err", text: e instanceof Error ? e.message : "Pull failed" });
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pull}
        disabled={pulling}
        className="w-full h-10 rounded-lg border border-border bg-white text-sm font-medium flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
      >
        <Download size={15} />
        {pulling ? "Checking The Grint…" : "Pull from The Grint"}
      </button>

      {msg && (
        <p
          className={cn(
            "text-xs",
            msg.tone === "ok" && "text-green-600",
            msg.tone === "warn" && "text-amber-600",
            msg.tone === "err" && "text-red-600",
          )}
        >
          {msg.text}
        </p>
      )}

      {choices.length > 0 && (
        <div className="space-y-1">
          {choices.map((c) => (
            <button
              key={c.scoreId}
              type="button"
              onClick={() => accept(c)}
              className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border bg-white active:scale-95"
            >
              {describe(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
