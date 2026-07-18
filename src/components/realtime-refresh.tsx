"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Subscribes to the viewed season's public Realtime channel and refreshes the
 * page's server data when a "changed" broadcast arrives — so scores, picks, and
 * standings update live without a manual reload. Debounced so a burst of writes
 * (e.g. a bulk Grint pull) coalesces into one refresh.
 */
export function RealtimeRefresh({ seasonId }: { seasonId: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`season:${seasonId}`)
      .on("broadcast", { event: "changed" }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [seasonId, router]);

  return null;
}
