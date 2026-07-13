"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setDay3Matches } from "@/lib/server/day3";

interface RosterPlayer {
  id: number;
  name: string;
}
type Side = "truffle" | "syndicate";
interface DraftMatch {
  trufflePlayerId: number;
  trufflePlayerName: string;
  syndicatePlayerId: number;
  syndicatePlayerName: string;
  nominatedBy: Side; // internal, for undo
}

const CAPTAIN_FALLBACK: Record<Side, string> = {
  truffle: "Truffle captain",
  syndicate: "Mycelium captain",
};

export function SetupBuilder({
  truffle,
  syndicate,
  truffleCaptain,
  syndicateCaptain,
}: {
  truffle: RosterPlayer[];
  syndicate: RosterPlayer[];
  truffleCaptain?: string;
  syndicateCaptain?: string;
}) {
  const router = useRouter();
  const captain: Record<Side, string> = {
    truffle: truffleCaptain ?? CAPTAIN_FALLBACK.truffle,
    syndicate: syndicateCaptain ?? CAPTAIN_FALLBACK.syndicate,
  };
  const label: Record<Side, string> = {
    truffle: "🐗 Truffle Hogs",
    syndicate: "🍄 Mycelium Syndicate",
  };

  const [started, setStarted] = useState(false);
  const [nominating, setNominating] = useState<Side>("truffle");
  const [remainingT, setRemainingT] = useState<RosterPlayer[]>(truffle);
  const [remainingS, setRemainingS] = useState<RosterPlayer[]>(syndicate);
  const [pending, setPending] = useState<{ player: RosterPlayer; team: Side } | null>(null);
  const [matches, setMatches] = useState<DraftMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const poolFor = (s: Side) => (s === "truffle" ? remainingT : remainingS);
  const setPoolFor = (s: Side) => (s === "truffle" ? setRemainingT : setRemainingS);
  const other = (s: Side): Side => (s === "truffle" ? "syndicate" : "truffle");
  const done = remainingT.length === 0 && remainingS.length === 0 && !pending;
  const uneven = truffle.length !== syndicate.length;

  function nominate(player: RosterPlayer) {
    setPoolFor(nominating)((prev) => prev.filter((p) => p.id !== player.id));
    setPending({ player, team: nominating });
  }

  function select(opponent: RosterPlayer) {
    if (!pending) return;
    const oppTeam = other(pending.team);
    setPoolFor(oppTeam)((prev) => prev.filter((p) => p.id !== opponent.id));
    const t = pending.team === "truffle" ? pending.player : opponent;
    const s = pending.team === "truffle" ? opponent : pending.player;
    setMatches((prev) => [
      ...prev,
      {
        trufflePlayerId: t.id,
        trufflePlayerName: t.name,
        syndicatePlayerId: s.id,
        syndicatePlayerName: s.name,
        nominatedBy: pending.team,
      },
    ]);
    setNominating(oppTeam); // the captain who just selected nominates next
    setPending(null);
  }

  function undo() {
    if (pending) {
      // cancel the nomination
      setPoolFor(pending.team)((prev) => [...prev, pending.player]);
      setPending(null);
      return;
    }
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      setRemainingT((prev) => [...prev, { id: last.trufflePlayerId, name: last.trufflePlayerName }]);
      setRemainingS((prev) => [...prev, { id: last.syndicatePlayerId, name: last.syndicatePlayerName }]);
      setNominating(last.nominatedBy);
      setMatches((prev) => prev.slice(0, -1));
    }
  }

  function save() {
    setError(null);
    startSaving(async () => {
      try {
        await setDay3Matches({
          matches: matches.map((m, i) => ({
            matchNumber: i + 1,
            trufflePlayerId: m.trufflePlayerId,
            syndicatePlayerId: m.syndicatePlayerId,
          })),
        });
        setSaved(true);
        setTimeout(() => router.push("/day3/leaderboard"), 900);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save matches");
      }
    });
  }

  if (truffle.length === 0 || syndicate.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        Both teams need players assigned before matchups can be drafted.
      </p>
    );
  }
  if (uneven) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        The teams have unequal active rosters ({truffle.length} vs {syndicate.length}).
        Match play needs even sides — adjust the rosters (trades / absences) first.
      </p>
    );
  }

  // Pre-start: choose who nominates first.
  if (!started) {
    return (
      <div className="py-6">
        <p className="text-sm text-muted-foreground mb-4 text-center">
          Captains draft the matchups by alternating: one nominates a player, the other
          picks an opponent, then it flips. Who nominates first?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["truffle", "syndicate"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setNominating(s);
                setStarted(true);
              }}
              className={cn(
                "rounded-xl p-4 text-center font-semibold border",
                s === "truffle"
                  ? "bg-truffle-light text-truffle border-truffle/30"
                  : "bg-syndicate-light text-syndicate border-syndicate/30",
              )}
            >
              {label[s]}
              <span className="block text-xs font-normal mt-1">{captain[s]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const activeSide: Side = pending ? other(pending.team) : nominating;
  const activePool = poolFor(activeSide);

  return (
    <>
      {/* remaining counts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-truffle-light rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-truffle">{label.truffle}</p>
          <p className="text-xs text-muted-foreground">{remainingT.length} left</p>
        </div>
        <div className="bg-syndicate-light rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-syndicate">{label.syndicate}</p>
          <p className="text-xs text-muted-foreground">{remainingS.length} left</p>
        </div>
      </div>

      {!done && (
        <div className="bg-white border border-border rounded-xl p-4 mb-4">
          {pending ? (
            <p className="text-sm mb-3">
              <span className="font-semibold">{captain[activeSide]}</span>: pick who plays
              against{" "}
              <span className={cn("font-bold", pending.team === "truffle" ? "text-truffle" : "text-syndicate")}>
                {pending.player.name}
              </span>
            </p>
          ) : (
            <p className="text-sm mb-3">
              <span className="font-semibold">{captain[activeSide]}</span>: nominate a{" "}
              {activeSide === "truffle" ? "Truffle Hog" : "Mycelium"} player (Match{" "}
              {matches.length + 1})
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {activePool.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => (pending ? select(p) : nominate(p))}
                className={cn(
                  "text-sm rounded-lg px-2 py-2.5 font-medium border active:scale-[0.98] transition-transform",
                  activeSide === "truffle"
                    ? "bg-truffle-light text-truffle border-truffle/30"
                    : "bg-syndicate-light text-syndicate border-syndicate/30",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Matchups ({matches.length}/{truffle.length})
            </h3>
            {!saved && (
              <button
                type="button"
                onClick={undo}
                className="text-xs text-muted-foreground flex items-center gap-1"
              >
                <RotateCcw size={12} /> Undo
              </button>
            )}
          </div>
          <div className="space-y-2">
            {matches.map((m, i) => (
              <div key={i} className="bg-white border border-border rounded-xl p-2.5 flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground w-6">M{i + 1}</span>
                <span className="flex-1 text-truffle font-medium truncate">{m.trufflePlayerName}</span>
                <span className="text-xs text-muted-foreground">vs</span>
                <span className="flex-1 text-right text-syndicate font-medium truncate">{m.syndicatePlayerName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {done && (
        <Button
          onClick={save}
          disabled={saving || saved}
          className={cn("w-full h-12 text-base", saved && "bg-green-500 hover:bg-green-500")}
        >
          {saved ? (
            <>
              <Check size={18} /> Matches Set!
            </>
          ) : saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Trophy size={18} /> Save Matchups & Start Day 3
            </>
          )}
        </Button>
      )}
    </>
  );
}
