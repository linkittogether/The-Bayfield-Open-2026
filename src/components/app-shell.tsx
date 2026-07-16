import Image from "next/image";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getCurrentSeason, listSeasons } from "@/lib/server/seasons";
import { AuthButton } from "./auth-button";
import { BottomNav } from "./bottom-nav";
import { RealtimeRefresh } from "./realtime-refresh";
import { SeasonSelector } from "./season-selector";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  /** @deprecated No longer rendered — the logo/title link home instead. Kept so existing callers still compile. */
  showBack?: boolean;
  /** @deprecated No longer rendered. */
  backTo?: string;
  /** The season year this page is scoped to (from the /[year] path segment). */
  year: number;
}

export async function AppShell({ children, title, year }: AppShellProps) {
  const [user, seasonList, currentSeason] = await Promise.all([
    getCurrentUser(),
    listSeasons(),
    getCurrentSeason(),
  ]);

  // The season whose data this page shows — used to scope the realtime channel.
  const viewedSeasonId = seasonList.find((s) => s.year === year)?.id ?? currentSeason.id;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <RealtimeRefresh seasonId={viewedSeasonId} />
      <header className="bg-primary text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/${year}`} className="flex-shrink-0" aria-label="Go to home">
            <Image
              src="/logo.png"
              alt="Bayfield Open"
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
              style={{ filter: "invert(1)" }}
              priority
            />
          </Link>

          <div className="flex-1 min-w-0">
            <Link
              href={`/${year}`}
              className="text-xs uppercase tracking-widest text-green-200 font-medium hover:text-white transition-colors"
            >
              The Bayfield Open
            </Link>
            {title && (
              <h1 className="text-lg font-bold truncate font-heading">
                {title}
              </h1>
            )}
          </div>

          {seasonList.length > 0 && (
            <SeasonSelector
              years={seasonList.map((s) => s.year)}
              viewedYear={year}
              currentYear={currentSeason.year}
            />
          )}

          {user ? (
            <AuthButton kind={user.kind} name={user.kind === "admin" ? user.admin.username : user.player.name} />
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-sm font-semibold flex-shrink-0"
            >
              <LogIn size={15} />
              <span>Login</span>
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {children}
      </main>

      <BottomNav year={year} />
    </div>
  );
}
