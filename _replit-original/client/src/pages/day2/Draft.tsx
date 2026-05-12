import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Flag, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Day2Draft() {
  const { data: teams, loading } = useApi(() => api.getDay3Teams(), []);

  const truffle = teams?.truffle_hogs || [];
  const syndicate = teams?.mycelium_syndicate || [];

  if (loading)
    return (
      <Layout title="Day 3 Teams" showBack backTo="/day2/leaderboard">
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );

  return (
    <Layout title="Day 3 Teams" showBack backTo="/day2/leaderboard">
      <div className="space-y-5">
        {/* Intro */}
        <div className="bg-[hsl(var(--primary)/0.06)] rounded-xl p-4 text-center">
          <img
            src="/logo.png"
            alt="Bayfield Open"
            className="h-14 w-14 object-contain mx-auto mb-3 opacity-80"
          />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            The Day 3 teams are set. After Day 2 concludes, captains{" "}
            <strong>Adison E</strong> and <strong>Josh W</strong> will select
            the match pairings.
          </p>
        </div>

        {/* Truffle Hogs */}
        <div className="bg-white border border-[hsl(var(--border))] rounded-xl overflow-hidden">
          <div className="bg-[hsl(var(--truffle-light))] px-4 py-3 flex items-center gap-2">
            <span className="text-xl">🐗</span>
            <div>
              <p className="font-bold text-[hsl(var(--truffle))]">
                The Truffle Hogs
              </p>
              <p className="text-xs text-[hsl(var(--truffle))/0.7]">
                Captain: Adison E
              </p>
            </div>
          </div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {truffle.map((p) => (
              <div
                key={p.player_id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <PlayerAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                {p.is_captain && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                    <Star size={10} fill="currentColor" /> Captain
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mycelium Syndicate */}
        <div id="syndicate" className="bg-white border border-[hsl(var(--border))] rounded-xl overflow-hidden">
          <div className="bg-[hsl(var(--syndicate-light))] px-4 py-3 flex items-center gap-2">
            <span className="text-xl">🍄</span>
            <div>
              <p className="font-bold text-[hsl(var(--syndicate))]">
                The Mycelium Syndicate
              </p>
              <p className="text-xs text-[hsl(var(--syndicate))/0.7]">
                Captain: Josh W
              </p>
            </div>
          </div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {syndicate.map((p) => (
              <div
                key={p.player_id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <PlayerAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                {p.is_captain && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                    <Star size={10} fill="currentColor" /> Captain
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Link to match setup */}
        <Link href="/day3/setup">
          <button className="w-full py-4 rounded-xl bg-[hsl(var(--primary))] text-white font-semibold flex items-center justify-center gap-2">
            <Flag size={18} /> Set Up Day 3 Matchups
          </button>
        </Link>
      </div>
    </Layout>
  );
}
