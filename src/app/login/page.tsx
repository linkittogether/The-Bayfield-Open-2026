import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { GoogleLoginButton } from "./google-login-button";

export const metadata = { title: "Log in · Bayfield Open" };

const ERROR_MESSAGES: Record<string, string> = {
  "not-registered":
    "That Google account isn't registered for the Bayfield Open. Ask the tournament admin to add your email.",
  oauth: "Sign-in didn't complete. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;

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
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
        <GoogleLoginButton />
        <p className="text-center text-xs text-muted-foreground mt-6">
          No account? Ask the tournament admin to register you.
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2">
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
