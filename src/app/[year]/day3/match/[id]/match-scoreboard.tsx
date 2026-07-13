"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { firstName } from "@/lib/format";
import { deleteDay3Hole, submitDay3Hole } from "@/lib/server/day3";

type Winner = "truffle_hogs" | "mycelium_syndicate" | "tie";

interface Match {
  id: number;
  matchNumber: number;
  trufflePlayerId: number;
  trufflePlayerName: string;
  trufflePhoto: string | null;
  syndicatePlayerId: number;
  syndicatePlayerName: string;
  syndicatePhoto: string | null;
  holes: { id: number; matchId: number; holeNumber: number; winner: Winner }[];
}

export function MatchScoreboard({
  match,
  canScore,
}: {
  match: Match;
  canScore: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const submitted = new Map(match.holes.map((h) => [h.holeNumber, h.winner]));
  const truffleHoles = match.holes.filter((h) => h.winner === "truffle_hogs").length;
  const syndicateHoles = match.holes.filter((h) => h.winner === "mycelium_syndicate").length;
  const tiedHoles = match.holes.filter((h) => h.winner === "tie").length;
  const nextHole = match.holes.length + 1;

  function submit(holeNumber: number, winner: Winner) {
    if (!canScore) return;
    startTransition(async () => {
      try {
        await submitDay3Hole({ matchId: match.id, holeNumber, winner });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to submit");
      }
    });
  }

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

  return (
    <>
      <div className="bg-primary text-white rounded-2xl p-4 mb-5">
        <div className="grid grid-cols-3 items-center gap-2 text-center">
          <div>
            <p className="text-xs text-green-200 mb-1 truncate">🐗 {match.trufflePlayerName}</p>
            <p className="text-4xl font-bold">{truffleHoles}</p>
          </div>
          <div>
            <p className="text-xs text-green-200 mb-1">Holes</p>
            <p className="text-2xl font-bold">{match.holes.length}/18</p>
            {tiedHoles > 0 && <p className="text-xs text-green-200">{tiedHoles} tied</p>}
          </div>
          <div>
            <p className="text-xs text-green-200 mb-1 truncate">🍄 {match.syndicatePlayerName}</p>
            <p className="text-4xl font-bold">{syndicateHoles}</p>
          </div>
        </div>
        {match.holes.length === 18 && (
          <div className="mt-3 text-center">
            <p className="text-green-200 text-xs uppercase tracking-wider">Match Complete</p>
            <p className="text-xl font-bold mt-1 font-heading">
              {truffleHoles > syndicateHoles
                ? `🐗 ${match.trufflePlayerName} wins!`
                : syndicateHoles > truffleHoles
                  ? `🍄 ${match.syndicatePlayerName} wins!`
                  : "It's a tie!"}
            </p>
          </div>
        )}
      </div>

      {nextHole <= 18 && (
        <div className="bg-white border border-border rounded-2xl p-4 mb-5">
          <p className="text-sm font-semibold mb-3 text-center">Hole {nextHole}</p>
          {!canScore && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
              <Lock size={15} className="text-amber-700 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Only {match.trufflePlayerName} or {match.syndicatePlayerName} (or an admin) can score this match.
              </p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={pending || !canScore}
              onClick={() => submit(nextHole, "truffle_hogs")}
              className="py-4 rounded-xl font-semibold text-sm bg-truffle-light text-truffle active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🐗
              <br />
              <span className="text-xs">{firstName(match.trufflePlayerName)}</span>
            </button>
            <button
              type="button"
              disabled={pending || !canScore}
              onClick={() => submit(nextHole, "tie")}
              className="py-4 rounded-xl font-semibold text-sm bg-muted text-muted-foreground active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✋
              <br />
              <span className="text-xs">Tie</span>
            </button>
            <button
              type="button"
              disabled={pending || !canScore}
              onClick={() => submit(nextHole, "mycelium_syndicate")}
              className="py-4 rounded-xl font-semibold text-sm bg-syndicate-light text-syndicate active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🍄
              <br />
              <span className="text-xs">{firstName(match.syndicatePlayerName)}</span>
            </button>
          </div>
        </div>
      )}

      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Hole History
      </h3>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 18 }, (_, i) => {
          const hole = i + 1;
          const winner = submitted.get(hole);
          return (
            <div
              key={hole}
              className={cn(
                "relative rounded-lg p-1.5 text-center text-xs font-bold",
                winner === "truffle_hogs"
                  ? "bg-truffle-light text-truffle"
                  : winner === "mycelium_syndicate"
                    ? "bg-syndicate-light text-syndicate"
                    : winner === "tie"
                      ? "bg-muted text-muted-foreground"
                      : "bg-border/30 text-border",
              )}
            >
              <span className="block text-[10px] leading-none mb-0.5">{hole}</span>
              <span>
                {winner === "truffle_hogs"
                  ? "🐗"
                  : winner === "mycelium_syndicate"
                    ? "🍄"
                    : winner === "tie"
                      ? "✋"
                      : "·"}
              </span>
              {winner && canScore && (
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
