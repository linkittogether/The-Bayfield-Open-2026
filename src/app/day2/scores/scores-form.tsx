"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";
import { submitDay2RoundScore } from "@/lib/server/day2";

export interface Day2TeamView {
  id: number;
  name: string | null;
  pickOrder: number;
  player1Id: number;
  player1Name: string;
  player1Handicap: number;
  player1Photo: string | null;
  player2Id: number;
  player2Name: string;
  player2Handicap: number;
  player2Photo: string | null;
}

export function Day2ScoresForm({
  teams,
  roundsByTeam,
  userId,
  isAdmin,
}: {
  teams: Day2TeamView[];
  roundsByTeam: Record<number, { round: number; netScore: number }[]>;
  userId: number | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(
    !isAdmin && teams.length === 1 ? teams[0].id : null,
  );
  const [round, setRound] = useState<1 | 2 | 3>(1);
  const [p1Gross, setP1Gross] = useState(36);
  const [p2Gross, setP2Gross] = useState(36);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const team = teams.find((t) => t.id === selectedId);
  const teamRounds = selectedId ? roundsByTeam[selectedId] ?? [] : [];

  const p1Net = team ? p1Gross - Math.floor(team.player1Handicap / 2) : 0;
  const p2Net = team ? p2Gross - Math.floor(team.player2Handicap / 2) : 0;

  const canSubmit =
    isAdmin ||
    (!!team && !!userId && (team.player1Id === userId || team.player2Id === userId));

  function submit() {
    if (!selectedId) return setError("Select a team");
    if (!canSubmit) return setError("You can only submit scores for your own team");
    setError(null);
    startTransition(async () => {
      try {
        await submitDay2RoundScore({
          teamId: selectedId,
          roundNumber: round,
          player1Gross: p1Gross,
          player2Gross: p2Gross,
        });
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submit failed");
      }
    });
  }

  return (
    <div className="space-y-5">
      {teams.length > 0 && (
        <div>
          <Label className="block mb-2">{isAdmin ? "Select Team" : "Your Team"}</Label>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {teams.map((t) => {
              const rounds = roundsByTeam[t.id] ?? [];
              const done = rounds.length;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => isAdmin && (setSelectedId(t.id), setError(null))}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                    selectedId === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-white",
                    !isAdmin && "cursor-default",
                  )}
                >
                  <div className="flex -space-x-2">
                    <PlayerAvatar name={t.player1Name} photoUrl={t.player1Photo} size="sm" />
                    <PlayerAvatar name={t.player2Name} photoUrl={t.player2Photo} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {t.player1Name} & {t.player2Name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      HCP {t.player1Handicap}/{t.player2Handicap} · {done}/3 rounds done
                    </p>
                  </div>
                  {done === 3 && <Check size={16} className="text-green-500" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedId && canSubmit && (
        <>
          <div>
            <Label className="block mb-2">Round</Label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((r) => {
                const submitted = teamRounds.find((rs) => rs.round === r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRound(r)}
                    className={cn(
                      "py-3 rounded-xl text-sm font-semibold border transition-all",
                      round === r
                        ? "bg-primary text-white border-transparent"
                        : "bg-white border-border",
                    )}
                  >
                    Round {r}
                    {submitted && (
                      <span className="block text-xs opacity-70">({submitted.netScore})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {team && (
            <div className="space-y-3">
              <ScoreInput
                label={`${team.player1Name} (HCP ${team.player1Handicap})`}
                value={p1Gross}
                onChange={setP1Gross}
                net={p1Net}
              />
              <ScoreInput
                label={`${team.player2Name} (HCP ${team.player2Handicap})`}
                value={p2Gross}
                onChange={setP2Gross}
                net={p2Net}
              />
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Combined Net Score (Round {round})
                </p>
                <p className="text-3xl font-bold">{p1Net + p2Net}</p>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {canSubmit && (
        <Button
          onClick={submit}
          disabled={!selectedId || pending || success}
          className={cn(
            "w-full h-12 text-base",
            success && "bg-green-500 hover:bg-green-500",
          )}
        >
          {success ? (
            <>
              <Check size={18} /> Score Saved!
            </>
          ) : pending ? (
            <Spinner />
          ) : (
            "Submit Round Score"
          )}
        </Button>
      )}
    </div>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
  net,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  net: number;
}) {
  return (
    <div className="bg-white border border-border rounded-xl p-3">
      <p className="text-sm font-medium mb-2 truncate">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(9, value - 1))}
          className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center active:scale-95"
        >
          <Minus size={16} />
        </button>
        <span className="flex-1 text-center text-2xl font-bold">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(99, value + 1))}
          className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center active:scale-95"
        >
          <Plus size={16} />
        </button>
        <div className="text-right w-16">
          <span className="text-lg font-bold">{net}</span>
          <p className="text-xs text-muted-foreground">net</p>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}
