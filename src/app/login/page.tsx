import Image from "next/image";
import { redirect } from "next/navigation";
import { listPlayersByName } from "@/lib/server/players";
import { getCurrentUser } from "@/lib/session";
import { LoginForms } from "./login-forms";

export const metadata = { title: "Log in · Bayfield Open" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const players = await listPlayersByName();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-center gap-3">
          <Image
            src="/logo.png"
            alt="Bayfield Open"
            width={64}
            height={64}
            className="h-16 w-16 object-contain"
            style={{ filter: "invert(1)" }}
            priority
          />
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-green-200 font-medium">
              Welcome to the
            </div>
            <h1 className="text-xl font-bold font-heading">Bayfield Open</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        <LoginForms players={players} />
        <p className="text-center text-xs text-muted-foreground mt-6">
          No account? Ask the tournament admin to register you.
        </p>
      </div>
    </div>
  );
}
