import { ChevronRight, Lock, Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PlayerAvatar } from "@/components/player-avatar";
import { ordinal } from "@/lib/format";
import { getDay1PicksOverview } from "@/lib/server/day1";
import { getCurrentUser } from "@/lib/session";
import { PickButton } from "./pick-button";

export const metadata = { title: "Partner Selection" };

export default async function Day1PicksPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getDay1PicksOverview()]);

  const userId = user?.kind === "player" ? user.player.id : null;
  const isAdmin = user?.kind === "admin";
  const canPickNow = !!data.nextPicker && (isAdmin || userId === data.nextPicker.id);

  if (data.pickingComplete) {
    return (
      <AppShell title="Partner Selection" showBack backTo="/day1/leaderboard">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-5 text-center">
          <Trophy size={36} className="mx-auto mb-2 text-gold" />
          <p className="font-bold text-green-800 text-lg font-heading">Teams are set!</p>
          <p className="text-sm text-green-700 mt-1">All partners have been selected for Day 2.</p>
        </div>

        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Day 2 Teams
        </h3>
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
    <AppShell title="Partner Selection" showBack backTo="/day1/leaderboard">
      <div className="bg-accent border border-secondary/30 rounded-2xl p-4 mb-5">
        <p className="text-sm font-semibold mb-1">How it works</p>
        <p className="text-xs text-muted-foreground">
          Starting with the 10th place player, each player picks a partner from the bottom 10. Then 9th, 8th... down to 1st.
        </p>
      </div>

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
                  {ordinal(data.nextPickerRank)} place · Net {data.nextPicker.netScore}
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
          <div className="space-y-2">
            {data.available.map((p) => (
              <PickButton
                key={p.id}
                pickerId={data.nextPicker!.id}
                pickedId={p.id}
                disabled={!canPickNow}
              >
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Rank #{p.rank} · Net {p.netScore} · HCP {p.handicap}
                  </p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </PickButton>
            ))}
          </div>
        </div>
      )}

      {data.teams.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">
            Teams So Far
          </h3>
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
