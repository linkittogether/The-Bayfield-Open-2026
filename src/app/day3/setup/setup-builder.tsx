"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Shuffle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setDay3Matches } from "@/lib/server/day3";

interface RosterPlayer {
  id: number;
  name: string;
}

export function SetupBuilder({
  truffle,
  syndicate,
}: {
  truffle: RosterPlayer[];
  syndicate: RosterPlayer[];
}) {
  const router = useRouter();
  const [matches, setMatches] = useState(() =>
    truffle.map((t, i) => ({
      trufflePlayerId: t.id,
      syndicatePlayerId: syndicate[i]?.id ?? 0,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(idx: number, key: "trufflePlayerId" | "syndicatePlayerId", value: number) {
    setMatches((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  }

  function randomize() {
    const shuffled = [...syndicate].sort(() => Math.random() - 0.5);
    setMatches(
      truffle.map((t, i) => ({
        trufflePlayerId: t.id,
        syndicatePlayerId: shuffled[i]?.id ?? 0,
      })),
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const payload = matches.map((m, i) => ({
          matchNumber: i + 1,
          trufflePlayerId: m.trufflePlayerId,
          syndicatePlayerId: m.syndicatePlayerId,
        }));
        await setDay3Matches({ matches: payload });
        setSaved(true);
        setTimeout(() => router.push("/day3/leaderboard"), 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save matches");
      }
    });
  }

  if (truffle.length === 0 || syndicate.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        Both teams need players assigned before matchups can be set up.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-truffle-light rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-truffle">🐗 Truffle Hogs</p>
          <p className="text-xs text-muted-foreground">{truffle.length} players</p>
        </div>
        <div className="bg-syndicate-light rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-syndicate">🍄 Mycelium Syndicate</p>
          <p className="text-xs text-muted-foreground">{syndicate.length} players</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-3 text-center">
        Captains: pair each Truffle Hog against a Mycelium Syndicate player for all matches.
      </p>

      <button
        onClick={randomize}
        type="button"
        className="w-full mb-4 py-3 border border-dashed border-border rounded-xl text-sm font-medium flex items-center justify-center gap-2 text-muted-foreground"
      >
        <Shuffle size={16} /> Randomize Matchups
      </button>

      <div className="space-y-3">
        {matches.map((m, i) => (
          <div key={i} className="bg-white border border-border rounded-xl p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Match {i + 1}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={m.trufflePlayerId}
                onChange={(e) => update(i, "trufflePlayerId", parseInt(e.target.value))}
                className="text-xs border border-truffle-light bg-truffle-light rounded-lg px-2 py-2 w-full text-truffle font-medium"
              >
                {truffle.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={m.syndicatePlayerId}
                onChange={(e) => update(i, "syndicatePlayerId", parseInt(e.target.value))}
                className="text-xs border border-syndicate-light bg-syndicate-light rounded-lg px-2 py-2 w-full text-syndicate font-medium"
              >
                {syndicate.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      <Button
        onClick={save}
        disabled={pending || saved || matches.some((m) => !m.trufflePlayerId || !m.syndicatePlayerId)}
        className={cn(
          "mt-5 w-full h-12 text-base",
          saved && "bg-green-500 hover:bg-green-500",
        )}
      >
        {saved ? (
          <>
            <Check size={18} /> Matches Set!
          </>
        ) : pending ? (
          <Spinner />
        ) : (
          <>
            <Trophy size={18} /> Save Matches & Start Day 3
          </>
        )}
      </Button>
    </>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}
