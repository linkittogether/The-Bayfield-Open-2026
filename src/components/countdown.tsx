"use client";

import { useEffect, useState } from "react";

// The Bayfield Open 2026 tees off 4:00 PM, Friday July 24 (Eastern / EDT = -04:00).
const TARGET = new Date("2026-07-24T16:00:00-04:00").getTime();

/**
 * Live countdown to the tournament start, styled for a green (primary)
 * background. Renders nothing once the start time has passed.
 */
export function Countdown() {
  // null until mounted so SSR and the first client paint match (no hydration
  // mismatch); then it ticks every second.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(TARGET - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Hide entirely once the tournament has started.
  if (remaining !== null && remaining <= 0) return null;

  const total = Math.max(0, remaining ?? 0);
  const units = [
    { value: Math.floor(total / 86_400_000), label: "Days" },
    { value: Math.floor((total % 86_400_000) / 3_600_000), label: "Hrs" },
    { value: Math.floor((total % 3_600_000) / 60_000), label: "Min" },
    { value: Math.floor((total % 60_000) / 1_000), label: "Sec" },
  ];
  const mounted = remaining !== null;

  return (
    <div className="w-full max-w-xs">
      <p className="text-green-200 text-[11px] font-medium uppercase tracking-widest mb-2 text-center">
        Tees off Fri, July 24 · 4:00 PM
      </p>
      <div className="grid grid-cols-4 gap-2">
        {units.map((u) => (
          <div key={u.label} className="bg-white/10 rounded-xl py-2">
            <div className="text-2xl font-bold tabular-nums leading-none text-white">
              {mounted ? String(u.value).padStart(2, "0") : "––"}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-green-200 mt-1">
              {u.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
