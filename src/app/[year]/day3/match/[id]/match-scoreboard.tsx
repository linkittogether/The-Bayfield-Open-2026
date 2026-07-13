"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { firstName } from "@/lib/format";
import { strokesOnHole, type Side } from "@/lib/matchplay";
import { deleteDay3Hole, submitDay3Hole } from "@/lib/server/day3";
import { GrintPullMatchButton } from "./grint-pull-match";

type Outcome = "truffle" | "syndicate" | "tie" | null;

interface HoleView {
  holeNumber: number;
  strokeIndex: number | null;
  truffleGross: number | null;
  syndicateGross: number | null;
  truffleNet: number | null;
  syndicateNet: number | null;
  outcome: Outcome;
}

export interface ScoreboardMatch {
  id: number;
  matchNumber: number;
  trufflePlayerId: number;
  trufflePlayerName: string;
  syndicatePlayerId: number;
  syndicatePlayerName: string;
  truffleCourseHandicap: number | null;
  syndicateCourseHandicap: number | null;
  strokesDiff: number;
  receiver: Side | null;
  holes: HoleView[];
  truffleHolesWon: number;
  syndicateHolesWon: number;
  status: "in_progress" | "final";
  winner: "truffle" | "syndicate" | "halved" | null;
  label: string;
  courseHoles: { holeNumber: number; strokeIndex: number | null; par: number | null }[];
}

export function MatchScoreboard({
  match,
  canScore,
}: {
  match: ScoreboardMatch;
  canScore: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const entered = new Map(match.holes.map((h) => [h.holeNumber, h]));
  const nextHole = match.holes.length + 1;
  const receiverName =
    match.receiver === "truffle"
      ? match.trufflePlayerName
      : match.receiver === "syndicate"
        ? match.syndicatePlayerName
        : null;

  function undo(holeNumber: number) {
    if (!canScore) return;
    startTransition(async () => {
      try {
        await deleteDay3Hole(match.id, holeNumber);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to undo");
      }
    });
  }

  const statusText =
    match.status === "final"
      ? match.winner === "halved"
        ? "Match halved (AS)"
        : match.winner === "truffle"
          ? `🐗 ${match.trufflePlayerName} wins ${match.label}`
          : `🍄 ${match.syndicatePlayerName} wins ${match.label}`
      : match.label || "Not started";

  return (
    <>
      {/* Match header */}
      <div className="bg-primary text-white rounded-2xl p-4 mb-5">
        <div className="grid grid-cols-3 items-center gap-2 text-center">
          <div>
            <p className="text-xs text-green-200 mb-1 truncate">🐗 {firstName(match.trufflePlayerName)}</p>
            <p className="text-4xl font-bold">{match.truffleHolesWon}</p>
            {match.truffleCourseHandicap != null && (
              <p className="text-[11px] text-green-200 mt-0.5">CH {match.truffleCourseHandicap}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-green-200 mb-1">Thru</p>
            <p className="text-2xl font-bold">{match.holes.length}/18</p>
          </div>
          <div>
            <p className="text-xs text-green-200 mb-1 truncate">🍄 {firstName(match.syndicatePlayerName)}</p>
            <p className="text-4xl font-bold">{match.syndicateHolesWon}</p>
            {match.syndicateCourseHandicap != null && (
              <p className="text-[11px] text-green-200 mt-0.5">CH {match.syndicateCourseHandicap}</p>
            )}
          </div>
        </div>
        <div className="mt-3 text-center">
          <p className="text-lg font-bold font-heading">{statusText}</p>
          {receiverName && match.strokesDiff > 0 && (
            <p className="text-xs text-green-200 mt-1">
              {match.receiver === "truffle" ? "🐗" : "🍄"} {firstName(receiverName)} receives{" "}
              {match.strokesDiff} stroke{match.strokesDiff === 1 ? "" : "s"}
            </p>
          )}
          {match.truffleCourseHandicap == null && (
            <p className="text-xs text-amber-200 mt-1">
              Course data not set for Sunday — strokes can&apos;t be computed.
            </p>
          )}
        </div>
      </div>

      {/* Pull the whole round from The Grint */}
      {canScore && nextHole <= 18 && (
        <div className="mb-5">
          <GrintPullMatchButton
            matchId={match.id}
            truffleName={match.trufflePlayerName}
            syndicateName={match.syndicatePlayerName}
          />
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            Fills every hole from both players&apos; logged Sunday rounds — you can still edit before it&apos;s final.
          </p>
        </div>
      )}

      {/* Current hole entry */}
      {nextHole <= 18 && (
        <div className="mb-5">
          {!canScore ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <Lock size={15} className="text-amber-700 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Only {firstName(match.trufflePlayerName)} or {firstName(match.syndicatePlayerName)} (or an
                admin) can score this match.
              </p>
            </div>
          ) : (
            <HoleEntry
              key={nextHole}
              match={match}
              holeNumber={nextHole}
              pending={pending}
              onSave={(t, s) =>
                startTransition(async () => {
                  try {
                    await submitDay3Hole({
                      matchId: match.id,
                      holeNumber: nextHole,
                      trufflePlayerGross: t,
                      syndicatePlayerGross: s,
                    });
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to submit");
                  }
                })
              }
            />
          )}
        </div>
      )}

      {/* Hole history */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Hole History
      </h3>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 18 }, (_, i) => {
          const hole = i + 1;
          const h = entered.get(hole);
          const outcome = h?.outcome ?? null;
          return (
            <div
              key={hole}
              className={cn(
                "relative rounded-lg p-1.5 text-center",
                outcome === "truffle"
                  ? "bg-truffle-light text-truffle"
                  : outcome === "syndicate"
                    ? "bg-syndicate-light text-syndicate"
                    : outcome === "tie"
                      ? "bg-muted text-muted-foreground"
                      : "bg-border/30 text-muted-foreground",
              )}
            >
              <span className="block text-[10px] leading-none mb-0.5">{hole}</span>
              <span className="text-xs font-bold">
                {h ? `${h.truffleGross ?? "–"}/${h.syndicateGross ?? "–"}` : "·"}
              </span>
              {h && canScore && (
                <button
                  type="button"
                  onClick={() => undo(hole)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 text-white rounded-full text-[8px] flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function HoleEntry({
  match,
  holeNumber,
  pending,
  onSave,
}: {
  match: ScoreboardMatch;
  holeNumber: number;
  pending: boolean;
  onSave: (truffleGross: number, syndicateGross: number) => void;
}) {
  const info = match.courseHoles.find((h) => h.holeNumber === holeNumber);
  const par = info?.par ?? 4;
  const si = info?.strokeIndex ?? null;
  const holeStrokes = strokesOnHole(match.strokesDiff, si);
  const truffleStrokes = match.receiver === "truffle" ? holeStrokes : 0;
  const syndicateStrokes = match.receiver === "syndicate" ? holeStrokes : 0;

  const [truffle, setTruffle] = useState(par);
  const [syndicate, setSyndicate] = useState(par);

  return (
    <div className="bg-white border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Hole {holeNumber}</p>
        <p className="text-xs text-muted-foreground">
          Par {par}
          {si != null && ` · SI ${si}`}
        </p>
      </div>

      <PlayerRow
        emoji="🐗"
        name={firstName(match.trufflePlayerName)}
        gross={truffle}
        strokes={truffleStrokes}
        onChange={setTruffle}
      />
      <PlayerRow
        emoji="🍄"
        name={firstName(match.syndicatePlayerName)}
        gross={syndicate}
        strokes={syndicateStrokes}
        onChange={setSyndicate}
      />

      <button
        type="button"
        disabled={pending}
        onClick={() => onSave(truffle, syndicate)}
        className="mt-3 w-full h-11 rounded-xl bg-primary text-white font-semibold active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Saving…" : `Save hole ${holeNumber}`}
      </button>
    </div>
  );
}

function PlayerRow({
  emoji,
  name,
  gross,
  strokes,
  onChange,
}: {
  emoji: string;
  name: string;
  gross: number;
  strokes: number;
  onChange: (v: number) => void;
}) {
  const net = gross - strokes;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {emoji} {name}
          {strokes > 0 && (
            <span className="ml-1 text-[11px] text-primary">
              {"•".repeat(strokes)} ({strokes} stroke{strokes === 1 ? "" : "s"})
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, gross - 1))}
        className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center active:scale-95"
      >
        <Minus size={15} />
      </button>
      <span className="w-7 text-center text-xl font-bold">{gross}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(20, gross + 1))}
        className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center active:scale-95"
      >
        <Plus size={15} />
      </button>
      <div className="w-9 text-right">
        <span className="text-base font-bold">{net}</span>
        <p className="text-[10px] text-muted-foreground leading-none">net</p>
      </div>
    </div>
  );
}
