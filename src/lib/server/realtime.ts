/**
 * Fire a lightweight "something changed" broadcast on a season's Realtime
 * channel so connected clients can refresh. Uses Supabase Realtime's HTTP
 * broadcast endpoint (serverless-friendly — no persistent socket). Best-effort:
 * never throws, never blocks the mutation that called it.
 *
 * Clients (see components/realtime-refresh.tsx) subscribe to the PUBLIC channel
 * `season:{id}` and call router.refresh() on the "changed" event. The payload
 * carries no data — the app re-fetches through its normal server components.
 */
export async function notifySeasonChange(seasonId: number): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `season:${seasonId}`,
            event: "changed",
            payload: {},
            private: false,
          },
        ],
      }),
    });
  } catch {
    // Best-effort only — realtime is a nicety, not required for correctness.
  }
}
