import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLandingSeason } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";

// Resolve current user + season at request time (no cached redirect).
export const dynamic = "force-dynamic";

// Landing page: explains what the app is (also the Google-verified home page).
// Signed-in users skip straight to the current season's app.
export default async function RootPage() {
  const [user, season] = await Promise.all([getCurrentUser(), getLandingSeason()]);
  if (user) redirect(`/${season.year}`);

  return (
    <div className="min-h-screen bg-primary text-white flex flex-col items-center justify-center px-6 py-12 text-center">
      <Image
        src="/logo.png"
        alt="Bayfield Open"
        width={120}
        height={120}
        className="h-28 w-28 object-contain mb-5"
        style={{ filter: "invert(1)" }}
        priority
      />
      <p className="text-green-200 text-xs font-medium mb-1 uppercase tracking-widest">
        The {season.year} Tournament
      </p>
      <h1 className="text-4xl font-bold mb-4 font-heading">The Bayfield Open</h1>
      <p className="text-green-100 max-w-md mb-8 leading-relaxed">
        The Bayfield Open is a private web app for our annual three-day golf
        tournament. Players sign in with Google to enter their own scores and
        follow the live leaderboards, partner draft, and match-play results.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/login"
          className="h-12 rounded-xl bg-white text-primary font-semibold flex items-center justify-center active:scale-95 transition-transform"
        >
          Sign in
        </Link>
        <Link href={`/${season.year}`} className="text-sm text-green-200 underline">
          View this year&apos;s tournament →
        </Link>
      </div>

      <Link href="/privacy" className="mt-10 text-xs text-green-200/70 underline">
        Privacy Policy
      </Link>
    </div>
  );
}
