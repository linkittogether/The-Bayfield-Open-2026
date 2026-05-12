import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { AuthButton } from "./auth-button";
import { BottomNav } from "./bottom-nav";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backTo?: string;
}

export async function AppShell({
  children,
  title,
  showBack,
  backTo,
}: AppShellProps) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {showBack && (
            <Link
              href={backTo || "/"}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
          )}

          <Image
            src="/logo.png"
            alt="Bayfield Open"
            width={44}
            height={44}
            className="h-11 w-11 object-contain flex-shrink-0"
            style={{ filter: "invert(1)" }}
            priority
          />

          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-green-200 font-medium">
              The Bayfield Open
            </div>
            {title && (
              <h1 className="text-lg font-bold truncate font-heading">
                {title}
              </h1>
            )}
          </div>

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

      <BottomNav />
    </div>
  );
}
