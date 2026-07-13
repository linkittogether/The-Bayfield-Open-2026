import { Shield } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getDay3Teams } from "@/lib/server/day3";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";
import { SetupBuilder } from "./setup-builder";

export const metadata = { title: "Day 3 — Match Setup" };

export default async function Day3SetupPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const { viewed: season, readOnly } = await getSeasonView(yr);
  const [user, teams] = await Promise.all([
    getCurrentUser(),
    getDay3Teams(season.id),
  ]);

  const isAdmin = user?.kind === "admin";
  const userId = user?.kind === "player" ? user.player.id : null;
  const allRoster = [...teams.truffleHogs, ...teams.myceliumSyndicate];
  const isCaptain = userId !== null && allRoster.some((p) => p.playerId === userId && p.isCaptain);
  const canSetup = !readOnly && (isAdmin || isCaptain);

  if (!canSetup) {
    return (
      <AppShell title="Match Setup" showBack backTo={`/${yr}/day3/leaderboard`} year={yr}>
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <Shield size={40} className="text-muted-foreground" />
          <div>
            <p className="font-semibold text-lg">Captains Only</p>
            <p className="text-sm text-muted-foreground mt-1">
              Only Adison E and Josh W (or admins) can set up the Day 3 match pairings.
              {!user && " Please log in."}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Match Setup" showBack backTo={`/${yr}/day3/leaderboard`} year={yr}>
      <SetupBuilder
        year={yr}
        truffle={teams.truffleHogs
          .filter((p) => !p.absent)
          .map((p) => ({ id: p.playerId, name: p.name }))}
        syndicate={teams.myceliumSyndicate
          .filter((p) => !p.absent)
          .map((p) => ({ id: p.playerId, name: p.name }))}
        truffleCaptain={teams.truffleHogs.find((p) => p.isCaptain)?.name}
        syndicateCaptain={teams.myceliumSyndicate.find((p) => p.isCaptain)?.name}
      />
    </AppShell>
  );
}
