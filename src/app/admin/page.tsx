import Link from "next/link";
import { Lock, Plus, Shield } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { listAdmins } from "@/lib/server/admins";
import { listPlayers } from "@/lib/server/players";
import { getCurrentSeason } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";
import { AdminManager } from "./admin-manager";
import { PlayerEditor } from "./player-editor";
import { ResetButton } from "./reset-button";
import { StatusRows } from "./status-rows";

export const metadata = { title: "Admin Panel" };

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AppShell title="Admin" showBack backTo="/">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <Lock size={40} className="text-muted-foreground" />
          <p className="font-semibold text-lg">Admin Login Required</p>
          <p className="text-sm text-muted-foreground">
            You must be logged in as an admin to access this page.
          </p>
          <Button asChild className="h-11">
            <Link href="/login">Go to Login</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (user.kind !== "admin") {
    return (
      <AppShell title="Admin" showBack backTo="/">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <Shield size={40} className="text-muted-foreground" />
          <p className="font-semibold text-lg">Admin Access Only</p>
          <p className="text-sm text-muted-foreground">
            You&apos;re logged in as a player. Admin access is required for this page.
          </p>
        </div>
      </AppShell>
    );
  }

  const [season, players, admins] = await Promise.all([
    getCurrentSeason(),
    listPlayers(),
    listAdmins(),
  ]);

  return (
    <AppShell title="Admin Panel" showBack backTo="/">
      <div className="space-y-5">
        <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-4 py-3">
          <Shield size={18} className="text-primary" />
          <span className="text-sm font-semibold text-primary">
            Logged in as admin: {user.admin.username}
          </span>
        </div>

        <Button asChild className="w-full h-11">
          <Link href="/day1/register">
            <Plus size={16} /> Register New Player
          </Link>
        </Button>

        <div className="bg-white border border-border rounded-xl p-4">
          <h3 className="font-semibold mb-3">Tournament Status · {season.year}</h3>
          <StatusRows
            rows={[
              ["Players registered", players.length],
              ["Current day", season.currentDay],
              ["Day 1 complete", season.day1Complete ? "Yes" : "No"],
              ["Partners picked", season.day1PickingComplete ? "Yes" : "No"],
              ["Day 2 complete", season.day2Complete ? "Yes" : "No"],
              ["Day 3 draft complete", season.day2DraftComplete ? "Yes" : "No"],
              ["Day 3 complete", season.day3Complete ? "Yes" : "No"],
            ]}
          />
        </div>

        <PlayerEditor
          players={players.map((p) => ({
            id: p.id,
            name: p.name,
            photoUrl: p.photoUrl,
            handicap: p.handicap,
            hasPin: p.hasPin,
          }))}
        />

        <AdminManager admins={admins.map((a) => ({ id: a.id, username: a.username }))} />

        <ResetButton seasonId={season.id} />
      </div>
    </AppShell>
  );
}
