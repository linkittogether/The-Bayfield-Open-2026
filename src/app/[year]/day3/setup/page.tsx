import { AppShell } from "@/components/app-shell";
import { getDay3Teams, getMatchDraft } from "@/lib/server/day3";
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
  const [user, teams, draft] = await Promise.all([
    getCurrentUser(),
    getDay3Teams(season.id),
    getMatchDraft(season.id),
  ]);

  const isAdmin = user?.kind === "admin";
  const userId = user?.kind === "player" ? user.player.id : null;
  const viewerSide: "truffle" | "syndicate" | null =
    userId !== null
      ? teams.truffleHogs.some((p) => p.playerId === userId && p.isCaptain)
        ? "truffle"
        : teams.myceliumSyndicate.some((p) => p.playerId === userId && p.isCaptain)
          ? "syndicate"
          : null
      : null;
  // Only admins/captains on the live season can drive the draft; everyone else
  // (players, logged-out spectators) sees it read-only and live as picks land.
  const canSetup = !readOnly && (isAdmin || viewerSide !== null);

  return (
    <AppShell title="Match Setup" showBack backTo={`/${yr}/day3/leaderboard`} year={yr}>
      <SetupBuilder
        year={yr}
        draft={draft}
        canSetup={canSetup}
        isAdmin={isAdmin}
        viewerSide={viewerSide}
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
