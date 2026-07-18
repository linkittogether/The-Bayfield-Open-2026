"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, RotateCcw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MatchDraft, MatchDraftSide } from "@/lib/matchplay";
import {
  nominateMatchPlayer,
  pickMatchOpponent,
  resetMatchDraft,
  setDay3Matches,
  startMatchDraft,
  undoMatchDraft,
} from "@/lib/server/day3";

interface RosterPlayer {
  id: number;
  name: string;
}

const CAPTAIN_FALLBACK: Record<MatchDraftSide, string> = {
  truffle: "Truffle captain",
  syndicate: "Mycelium captain",
};
const LABEL: Record<MatchDraftSide, string> = {
  truffle: "🐗 Truffle Hogs",
  syndicate: "🍄 Mycelium Syndicate",
};
const other = (s: MatchDraftSide): MatchDraftSide =>
  s === "truffle" ? "syndicate" : "truffle";

export function SetupBuilder({
  year,
  draft,
  canSetup,
  isAdmin,
  viewerSide,
  truffle,
  syndicate,
  truffleCaptain,
  syndicateCaptain,
}: {
  year: number;
  draft: MatchDraft | null;
  /** Admin/captain on the live season may drive the draft; others spectate. */
  canSetup: boolean;
  isAdmin: boolean;
  viewerSide: MatchDraftSide | null;
  truffle: RosterPlayer[];
  syndicate: RosterPlayer[];
  truffleCaptain?: string;
  syndicateCaptain?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const captain: Record<MatchDraftSide, string> = {
    truffle: truffleCaptain ?? CAPTAIN_FALLBACK.truffle,
    syndicate: syndicateCaptain ?? CAPTAIN_FALLBACK.syndicate,
  };

  // Derive everything from the server-persisted draft (single source of truth).
  const started = draft?.started ?? false;
  const matches = draft?.matches ?? [];
  const nomination = draft?.pending ?? null;
  const nominating: MatchDraftSide = draft?.nominating ?? "truffle";

  const nameById = new Map([...truffle, ...syndicate].map((p) => [p.id, p.name]));
  const used = new Set<number>();
  for (const m of matches) {
    used.add(m.trufflePlayerId);
    used.add(m.syndicatePlayerId);
  }
  if (nomination) used.add(nomination.playerId);

  const remainingT = truffle.filter((p) => !used.has(p.id));
  const remainingS = syndicate.filter((p) => !used.has(p.id));
  const activeSide: MatchDraftSide = nomination ? other(nomination.side) : nominating;
  const activePool = activeSide === "truffle" ? remainingT : remainingS;
  const done = remainingT.length === 0 && remainingS.length === 0 && !nomination;
  const uneven = truffle.length !== syndicate.length;

  // Admins drive both sides; a captain may only act when it's their side's turn.
  const canActNow = isAdmin || viewerSide === activeSide;
  const undoSide: MatchDraftSide | null = nomination
    ? nomination.side
    : matches.length > 0
      ? other(matches[matches.length - 1].nominatedBy)
      : null;
  const canUndo = isAdmin || (undoSide !== null && viewerSide === undoSide);

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  function save() {
    start(async () => {
      try {
        await setDay3Matches({
          matches: matches.map((m, i) => ({
            matchNumber: i + 1,
            trufflePlayerId: m.trufflePlayerId,
            syndicatePlayerId: m.syndicatePlayerId,
          })),
        });
        setSaved(true);
        setTimeout(() => router.push(`/${year}/day3/leaderboard`), 900);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save matches");
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

  // Pre-start: choose who nominates first (spectators just wait).
  if (!started) {
    if (!canSetup) {
      return (
        <p className="text-sm text-muted-foreground py-10 text-center">
          The captains haven&apos;t started the match draft yet. Pairings will
          appear here live as they&apos;re picked.
        </p>
      );
    }
    return (
      <div className="py-6">
        <p className="text-sm text-muted-foreground mb-4 text-center">
          Captains draft the matchups by alternating: one nominates a player, the other
          picks an opponent, then it flips. Who nominates first?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["truffle", "syndicate"] as MatchDraftSide[]).map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => run(() => startMatchDraft(s))}
              className={cn(
                "rounded-xl p-4 text-center font-semibold border disabled:opacity-60",
                s === "truffle"
                  ? "bg-truffle-light text-truffle border-truffle/30"
                  : "bg-syndicate-light text-syndicate border-syndicate/30",
              )}
            >
              {LABEL[s]}
              <span className="block text-xs font-normal mt-1">{captain[s]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-truffle-light rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-truffle">{LABEL.truffle}</p>
          <p className="text-xs text-muted-foreground">{remainingT.length} left</p>
        </div>
        <div className="bg-syndicate-light rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-syndicate">{LABEL.syndicate}</p>
          <p className="text-xs text-muted-foreground">{remainingS.length} left</p>
        </div>
      </div>

      {!done && (
        <div className="bg-white border border-border rounded-xl p-4 mb-4">
          {!canActNow ? (
            <p className="text-sm mb-3 text-muted-foreground">
              Waiting for <span className="font-semibold">{captain[activeSide]}</span> to{" "}
              {nomination ? "pick an opponent" : `nominate (Match ${matches.length + 1})`}…
            </p>
          ) : nomination ? (
            <p className="text-sm mb-3">
              <span className="font-semibold">{captain[activeSide]}</span>: pick who plays
              against{" "}
              <span
                className={cn(
                  "font-bold",
                  nomination.side === "truffle" ? "text-truffle" : "text-syndicate",
                )}
              >
                {nameById.get(nomination.playerId)}
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
                disabled={pending || !canActNow}
                onClick={() =>
                  run(() =>
                    nomination ? pickMatchOpponent(p.id) : nominateMatchPlayer(p.id),
                  )
                }
                className={cn(
                  "text-sm rounded-lg px-2 py-2.5 font-medium border active:scale-[0.98] transition-transform disabled:opacity-60",
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
            {!saved && canUndo && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => undoMatchDraft())}
                className="text-xs text-muted-foreground flex items-center gap-1 disabled:opacity-60"
              >
                <RotateCcw size={12} /> Undo
              </button>
            )}
          </div>
          <div className="space-y-2">
            {matches.map((m, i) => (
              <div
                key={i}
                className="bg-white border border-border rounded-xl p-2.5 flex items-center gap-2 text-sm"
              >
                <span className="text-xs text-muted-foreground w-6">M{i + 1}</span>
                <span className="flex-1 text-truffle font-medium truncate">
                  {nameById.get(m.trufflePlayerId)}
                </span>
                <span className="text-xs text-muted-foreground">vs</span>
                <span className="flex-1 text-right text-syndicate font-medium truncate">
                  {nameById.get(m.syndicatePlayerId)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {done ? (
        canSetup ? (
          <Button
            onClick={save}
            disabled={pending || saved}
            className={cn("w-full h-12 text-base", saved && "bg-green-500 hover:bg-green-500")}
          >
            {saved ? (
              <>
                <Check size={18} /> Matches Set!
              </>
            ) : pending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Trophy size={18} /> Save Matchups & Start Day 3
              </>
            )}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            All matchups are set — waiting for the captains to start Day 3.
          </p>
        )
      ) : (
        isAdmin && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => resetMatchDraft())}
            className="w-full text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            Reset draft
          </button>
        )
      )}
    </>
  );
}
