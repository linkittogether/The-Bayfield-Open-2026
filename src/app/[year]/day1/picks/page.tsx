import { Lock, Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LockDraftButton } from "@/components/lock-draft-button";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatNet, ordinal } from "@/lib/format";
import { getDay1PicksOverview } from "@/lib/server/day1";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";
import { PickList } from "./pick-list";
import { UndoPickButton } from "./undo-pick-button";

export const metadata = { title: "Partner Selection" };

export default async function Day1PicksPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const { viewed: season, readOnly } = await getSeasonView(yr);
  const [user, data] = await Promise.all([
    getCurrentUser(),
    getDay1PicksOverview(season.id),
  ]);

  const userId = user?.kind === "player" ? user.player.id : null;
  const isAdmin = user?.kind === "admin";
  const canPickNow =
    !readOnly && !!data.nextPicker && (isAdmin || userId === data.nextPicker.id);

  // Most recent pick = first team (overview orders by asc pickOrder, and picking
  // descends from rank 10). Used by the admin sequential-undo control.
  const latestTeam = data.teams[0];
  const latestPicker = latestTeam
    ? data.leaderboard.find((p) => p.id === latestTeam.player1Id)
    : undefined;
  const latestPicked = latestTeam
    ? data.leaderboard.find((p) => p.id === latestTeam.player2Id)
    : undefined;
  const lastPickLabel = latestTeam
    ? `${latestPicker?.name}'s pick of ${latestPicked?.name}`
    : undefined;
  const showUndo = !readOnly && isAdmin && data.teams.length > 0;

  if (data.pickingComplete) {
    return (
      <AppShell title="Partner Selection" showBack backTo={`/${yr}/day1/leaderboard`} year={yr}>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-5 text-center">
          <Trophy size={36} className="mx-auto mb-2 text-gold" />
          <p className="font-bold text-green-800 text-lg font-heading">Teams are set!</p>
          <p className="text-sm text-green-700 mt-1">All partners have been selected for Day 2.</p>
        </div>

        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Day 2 Teams
          </h3>
          {showUndo && <UndoPickButton lastPickLabel={lastPickLabel} />}
        </div>
        <div className="space-y-2">
          {data.teams.map((team) => {
            const p1 = data.leaderboard.find((p) => p.id === team.player1Id);
            const p2 = data.leaderboard.find((p) => p.id === team.player2Id);
            return (
              <div
                key={team.id}
                className="bg-white rounded-xl border border-border p-3 flex items-center gap-3"
              >
                <Users size={18} className="text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {p1?.name} <span className="text-muted-foreground">+</span> {p2?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ranks #{p1?.rank} & #{p2?.rank}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Partner Selection" showBack backTo={`/${yr}/day1/leaderboard`} year={yr}>
      {data.nextPicker ? (
        <div className="bg-accent border border-secondary/30 rounded-2xl p-4 mb-5">
          <p className="text-sm font-semibold mb-1">How it works</p>
          <p className="text-xs text-muted-foreground">
            Starting with the 10th place player, each player picks a partner from the bottom 10. Then 9th, 8th... down to 1st.
          </p>
        </div>
      ) : data.state?.day1PickingStarted ? (
        // All pairs are made but the draft isn't locked yet — offer the lock here
        // too (same action as the home "next step" tile).
        <div className="bg-primary text-white rounded-2xl p-4 mb-5">
          <p className="font-bold text-lg font-heading">All pairs are set</p>
          <p className="text-green-200 text-sm mt-0.5">
            {isAdmin && !readOnly
              ? "Review the pairs below, then lock the draft to start Day 2."
              : "Waiting for the organizer to lock the pairs."}
          </p>
          {isAdmin && !readOnly && <LockDraftButton />}
        </div>
      ) : null}

      {data.nextPicker && data.nextPickerRank !== null && (
        <div className="mb-5">
          <div className="bg-primary text-white rounded-2xl p-4 mb-4">
            <p className="text-green-200 text-xs uppercase tracking-wider mb-2">Now Picking</p>
            <div className="flex items-center gap-3">
              <PlayerAvatar
                name={data.nextPicker.name}
                photoUrl={data.nextPicker.photoUrl}
                size="md"
              />
              <div>
                <p className="font-bold text-lg font-heading">{data.nextPicker.name}</p>
                <p className="text-green-200 text-sm">
                  {ordinal(data.nextPickerRank)} place · Net {formatNet(data.nextPicker.netScore)}
                </p>
              </div>
            </div>
          </div>

          {!canPickNow && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
              <Lock size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                {user?.kind === "player"
                  ? `Only ${data.nextPicker.name} can make this pick. Hand the device over, or have an admin sign in.`
                  : `Sign in as ${data.nextPicker.name} (or as an admin) to make this pick.`}
              </p>
            </div>
          )}

          <h3 className="text-sm font-semibold mb-2">Available Players (ranks 11–20)</h3>
          <PickList
            pickerId={data.nextPicker.id}
            pickerName={data.nextPicker.name}
            canPick={canPickNow}
            candidates={data.available.map((p) => ({
              id: p.id,
              name: p.name,
              photoUrl: p.photoUrl,
              rank: p.rank,
              netScore: p.netScore,
              handicap: p.handicap,
            }))}
          />
        </div>
      )}

      {data.teams.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2 mb-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Teams So Far
            </h3>
            {showUndo && <UndoPickButton lastPickLabel={lastPickLabel} />}
          </div>
          <div className="space-y-2">
            {data.teams.map((team) => {
              const p1 = data.leaderboard.find((p) => p.id === team.player1Id);
              const p2 = data.leaderboard.find((p) => p.id === team.player2Id);
              return (
                <div
                  key={team.id}
                  className="bg-white rounded-xl border border-border p-3 flex items-center gap-3"
                >
                  <Users size={16} className="text-primary" />
                  <p className="text-sm">
                    {p1?.name} <span className="text-muted-foreground">+</span> {p2?.name}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
