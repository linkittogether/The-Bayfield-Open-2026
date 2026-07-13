"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SegmentSetup } from "@/lib/server/courses";
import { setSegmentTee } from "@/lib/server/courses";

export function TeeEditor({
  segment,
  readOnly,
}: {
  segment: SegmentSetup;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tee, setTee] = useState(segment.tee ?? "");
  const [data, setData] = useState({
    rating: segment.rating,
    slope: segment.slope,
    par: segment.par,
  });

  // Show the current tee even if it isn't in the (best-effort) fetched list.
  const options = segment.availableTees.map((t) => t.tee);
  if (segment.tee && !options.includes(segment.tee)) options.unshift(segment.tee);

  function change(next: string) {
    setTee(next);
    startTransition(async () => {
      try {
        const res = await setSegmentTee({ segmentId: segment.segmentId, tee: next });
        setData({ rating: res.rating, slope: res.slope, par: res.par });
        toast.success(`${segment.label}: ${next} (${res.rating}/${res.slope}/${res.par})`);
        router.refresh();
      } catch (err) {
        setTee(segment.tee ?? "");
        toast.error(err instanceof Error ? err.message : "Failed to set tee");
      }
    });
  }

  return (
    <div className="bg-white border border-border rounded-xl p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{segment.label}</p>
          <p className="text-xs text-muted-foreground">
            {segment.courseName ?? "—"} · {segment.holes}h
          </p>
        </div>
        <select
          value={tee}
          disabled={readOnly || pending || options.length === 0}
          onChange={(e) => change(e.target.value)}
          className="h-10 rounded-lg border border-border bg-white px-2 text-sm disabled:opacity-60 max-w-[9rem]"
        >
          {options.length === 0 && <option value="">No tees found</option>}
          {segment.availableTees.map((t) => (
            <option key={t.tee} value={t.tee}>
              {t.tee} ({t.rating}/{t.slope})
            </option>
          ))}
          {segment.tee && !segment.availableTees.some((t) => t.tee === segment.tee) && (
            <option value={segment.tee}>{segment.tee}</option>
          )}
        </select>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {data.rating != null
          ? `Rating ${data.rating} · Slope ${data.slope} · Par ${data.par}`
          : "Course data not set"}
        {pending && " · updating…"}
      </p>
    </div>
  );
}
