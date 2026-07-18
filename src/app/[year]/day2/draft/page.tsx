import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { getDay3Matches, getDay3Teams, getMatchDraft } from "@/lib/server/day3";
import { getSeasonView } from "@/lib/server/seasons";

export const metadata = { title: "Day 3 Teams" };

export default async function Day2DraftPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const { viewed: season, readOnly } = await getSeasonView(yr);
  const [teams, draft, matches] = await Promise.all([
    getDay3Teams(season.id),
    getMatchDraft(season.id),
    getDay3Matches(season.id),
  ]);

  // On the live season, once the matchup draft has begun (or matchups are
  // saved) this team-review page is stale — bounce to the right place.
  if (!readOnly) {
    if (matches.length > 0) redirect(`/${yr}/day3/leaderboard`);
    if (draft?.started) redirect(`/${yr}/day3/setup`);
  }

  return (
    <AppShell title="Day 3 Teams" showBack backTo={`/${yr}/day2/leaderboard`} year={yr}>
      <div className="space-y-5">
        <div className="bg-primary/5 rounded-xl p-4 text-center">
          <Image
            src="/logo.png"
            alt="Bayfield Open"
            width={56}
            height={56}
            className="h-14 w-14 object-contain mx-auto mb-3 opacity-80"
          />
          <p className="text-sm text-muted-foreground">
            The Day 3 teams are set. After Day 2 concludes, captains <strong>Adison E</strong> and{" "}
            <strong>Josh W</strong> will select the match pairings.
          </p>
        </div>

        {!readOnly && (
          <Button asChild className="w-full h-12 text-base">
            <Link href={`/${yr}/day3/setup`}>
              <Flag size={18} /> Set Up Day 3 Matchups
            </Link>
          </Button>
        )}

        <TeamCard
          name="The Truffle Hogs"
          icon="🐗"
          captainName="Adison E"
          bgClass="bg-truffle-light"
          textClass="text-truffle"
          players={teams.truffleHogs.filter((p) => !p.absent)}
        />

        <TeamCard
          name="The Mycelium Syndicate"
          icon="🍄"
          captainName="Josh W"
          bgClass="bg-syndicate-light"
          textClass="text-syndicate"
          players={teams.myceliumSyndicate.filter((p) => !p.absent)}
        />
      </div>
    </AppShell>
  );
}

function TeamCard({
  name,
  icon,
  captainName,
  bgClass,
  textClass,
  players,
}: {
  name: string;
  icon: string;
  captainName: string;
  bgClass: string;
  textClass: string;
  players: Awaited<ReturnType<typeof getDay3Teams>>["truffleHogs"];
}) {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className={`${bgClass} px-4 py-3 flex items-center gap-2`}>
        <span className="text-xl">{icon}</span>
        <div>
          <p className={`font-bold ${textClass}`}>{name}</p>
          <p className={`text-xs ${textClass} opacity-80`}>Captain: {captainName}</p>
        </div>
      </div>
      {players.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">No players assigned yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {players.map((p) => (
            <div key={p.playerId} className="flex items-center gap-3 px-4 py-2.5">
              <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size="sm" />
              <span className="flex-1 text-sm font-medium">{p.name}</span>
              {p.isCaptain && (
                <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                  <Star size={10} fill="currentColor" /> Captain
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
