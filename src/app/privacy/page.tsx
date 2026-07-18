import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Privacy Policy · The Bayfield Open" };

// Public, no-auth page — used as the Google OAuth consent-screen privacy link.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Bayfield Open"
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
            style={{ filter: "invert(1)" }}
          />
          <div>
            <div className="text-xs uppercase tracking-widest text-green-200 font-medium">
              The Bayfield Open
            </div>
            <h1 className="text-lg font-bold font-heading">Privacy Policy</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6 text-sm leading-relaxed text-foreground">
        <p className="text-muted-foreground">Last updated: July 2026</p>

        <p>
          The Bayfield Open is a private app used to run a small, invite-only golf
          tournament. This policy describes what information the app collects and how
          it is used.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading">Information we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Google account information</strong> — your email address and name,
              obtained when you sign in with Google. This is used only to identify you
              and log you in.
            </li>
            <li>
              <strong>Tournament data</strong> — your name, golf handicap, and the scores
              recorded during the tournament, entered by you or a tournament
              administrator.
            </li>
            <li>
              <strong>Round data from TheGrint</strong> — if you or an admin choose to
              import scores, the app fetches your matching rounds from TheGrint on your
              behalf.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading">How we use it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To sign you in and run the tournament — scoring, standings, and pairings.</li>
            <li>
              We do <strong>not</strong> sell your data, share it with third parties, or
              use it for advertising.
            </li>
          </ul>
          <p>
            The app&apos;s use of information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including its Limited Use requirements.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading">Storage &amp; security</h2>
          <p>
            Data is stored in a private database (Supabase) and the app is hosted on
            Vercel. Access to tournament data requires signing in with an approved Google
            account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading">Retention &amp; removal</h2>
          <p>
            Tournament records are kept across seasons for historical results. To have
            your personal data removed, contact the tournament organizer at{" "}
            <a href="mailto:mcdowell.duncan@gmail.com" className="text-primary underline">
              mcdowell.duncan@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading">Contact</h2>
          <p>
            Questions about this policy can be sent to{" "}
            <a href="mailto:mcdowell.duncan@gmail.com" className="text-primary underline">
              mcdowell.duncan@gmail.com
            </a>
            .
          </p>
        </section>

        <p className="pt-4">
          <Link href="/" className="text-primary underline">
            ← Back to The Bayfield Open
          </Link>
        </p>
      </main>
    </div>
  );
}
