# The Bayfield Open

Mobile-first web app for the Bayfield Open — a private 3-day golf tournament (~20 players). Players sign in with Google, enter their own scores, and follow live standings across three competitions: the **Individual** (lowest cumulative net), the **Pairs** (Saturday partner play), and the **Huron Cup** (Sunday Truffle Hogs vs Mycelium Syndicate match play).

The app is **multi-season**: every tournament is a `season` keyed by year, and everything (rosters, courses, scores, matches) is scoped to it. Handicaps, scores, and course data can be pulled from [TheGrint](https://thegrint.com), or entered by hand — both use the same WHS math.

> **How the tournament actually works** — formats, scoring formulas, the draft, and per-season course/tee config — is documented in [docs/tournament-mechanics.md](./docs/tournament-mechanics.md). That doc is the source of truth for mechanics; this README is about running the code.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind v4 + [shadcn/ui](https://ui.shadcn.com) (Radix primitives) |
| Database | Supabase Postgres via Drizzle ORM (`postgres-js` driver, `prepare: false` for the transaction pooler) |
| Storage | Supabase Storage (`players` bucket) for player photos |
| Realtime | Supabase Realtime HTTP broadcast — mutations ping a `season:{id}` channel; clients `router.refresh()` (see `components/realtime-refresh.tsx`) |
| Auth | **Google SSO** via Supabase Auth for identity, then an `iron-session` signed cookie (see [Auth model](#auth-model)) |
| Hosting | Vercel (Server Actions, `bodySizeLimit: 6mb` for photo uploads) |

## Prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier is fine) — Postgres + Storage + Auth (Google provider enabled)

## First-time setup

```bash
git clone git@github.com:duncanmcdowell/The-Bayfield-Open-2026.git
cd The-Bayfield-Open-2026
npm install
```

### Environment

Copy the template and fill in values from your Supabase dashboard:

```bash
cp .env.example .env.local
```

| Var | Where to find it | Notes |
|---|---|---|
| `DATABASE_URL` | Project Settings → Database → Connection string → **Transaction** mode (port 6543) | Pooled connection. Required for serverless. |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API → Publishable key (`sb_publishable_…`) | Browser-safe |
| `SUPABASE_SECRET_KEY` | Project Settings → API → Secret key (`sb_secret_…`) | Server-only. Storage uploads + Realtime broadcast. |
| `SESSION_SECRET` | Generate with `openssl rand -hex 32` | Signs the `bayfield_session` cookie |
| `GRINT_COOKIE` *(optional)* | `Cookie:` header from a logged-in thegrint.com request | Session for the Grint scripts/actions |
| `GRINT_EMAIL` + `GRINT_PASSWORD` *(optional)* | Your TheGrint credentials | Enables **auto-login/refresh** when the cookie goes stale (the refreshed cookie is cached in the `app_config` table) |

Google SSO also requires the **Google provider enabled** in Supabase Auth, with the OAuth redirect pointed at `/auth/callback`.

### Database

```bash
npm run db:migrate     # Apply all migrations to Supabase
npm run db:seed        # Insert the two teams + a current-year season row
npm run storage:setup  # Create the public `players` storage bucket
```

There is **no default admin** — login is Google, so an admin must be a real player row with an assigned Google email and `is_admin = true`. Seed a season, add yourself as a player (`email` = your Google address, `is_admin` on) directly or via `npm run db:studio`, then sign in.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a registered Google account. Signed-in users are redirected to the current season at `/[year]`.

## Available scripts

```bash
# Development
npm run dev              # Start dev server (Turbopack, port 3000)
npm run build            # Production build
npm run start            # Run the production build
npm run lint

# Database (Drizzle Kit)
npm run db:generate      # Generate SQL migrations from src/db/schema.ts
npm run db:migrate       # Apply pending migrations
npm run db:push          # Push schema directly without migration files (dev only)
npm run db:studio        # Drizzle Studio at https://local.drizzle.studio
npm run db:seed          # Seed teams + current-year season

# Supabase Storage
npm run storage:setup    # Create/update the `players` bucket (idempotent)

# Seasons
npm run season:setup     # Declarative per-year config: courses, tees, dates
                         # (auto-pulls rating/slope/par + stroke index from Grint)
npm run season:current   # Set which season is "current" (e.g. -- 2026)
npm run backfill:seasons # One-off: migrate legacy data into the seasons model

# TheGrint
npm run grint:friends    # Dump the friends list (id → name/handicap)
npm run grint:handicaps  # Sync player handicap indices from Grint profiles
npm run grint:round      # Look up a player's round (score/rating/slope)
npm run grint:import     # Batch-import stroke-play scores (match by course+holes+date)

# Utilities / test data
npm run check:emails     # Verify player → Google email assignments
npm run draft:seed       # Seed Day 1 draft test data
npm run draft:wipe       # Wipe Day 1 draft test data
```

Additional one-off scripts live in `scripts/` (e.g. `grint-tees.ts` to list a course's exact Grint tee names, `clone-2024-sandbox.ts`, and the `smoke-*.ts` domain/storage smoke tests).

## Project layout

```
src/
  app/
    page.tsx                 Landing page; redirects signed-in users to /[year]
    login/                   Google sign-in
    auth/callback/           OAuth return → maps verified email to a player, sets session
    privacy/                 Privacy policy
    [year]/                  Everything below is scoped to a season (404s on unknown year)
      page.tsx               Season home (day cards)
      day1/                  register, scores, picks (partner draft), leaderboard
      day2/                  scores, draft (Day 3 team draft), leaderboard
      day3/                  setup, match/[id], leaderboard
      courses/               Course & tee selection (admin) — re-pulls rating/slope/par
      admin/                 Players, seasons, roster, admin toggles
  components/                app-shell, bottom-nav, auth-button, season-selector,
                             player-avatar, realtime-refresh, grint/handicap pull buttons
    ui/                      shadcn-generated components
  db/
    schema.ts                Drizzle tables (seasons, teams, players, season_rosters,
                             courses, segments, course_holes, segment_scores, day2_teams,
                             day3_matches, day3_holes, app_config)
    index.ts                 db client
    seed.ts                  Teams + current-year season
  lib/
    handicap.ts              WHS course-handicap engine (stroke play) — pure
    matchplay.ts             Match-play engine (strokes, per-hole net winner, closeout)
    format.ts                netScore9, ordinal, initials, firstName
    session.ts               iron-session helpers; getCurrentUser (admin = players.isAdmin)
    auth-actions.ts          logout Server Action (login is Google, see auth/callback)
    supabase/                Supabase browser + server clients (for Auth)
    supabase-storage.ts      Storage client (server, secret-key)
    server/                  Domain Server Actions
      auth-guards.ts         requireAdmin / requireAdminOrSelf / …OrTeamMember / …OrMatchPlayer
      seasons.ts             Current/by-year lookup, season CRUD, switch current
      players.ts             Player CRUD + per-season roster/handicap
      scoring.ts             Season stroke-play standings (computes net; never stored)
      day1.ts / day2.ts      Stroke-play scores, leaderboards, partner picks, Day 3 draft
      day3.ts                Match play — hole-by-hole gross → net winner, standings
      courses.ts             Courses/segments + tee changes
      grint.ts               Handicap sync from Grint profiles
      grint-rounds.ts        Fetch Grint rounds / course data / hole scores (cookie auto-refresh)
      grint-import.ts        Match Grint rounds to segments
      grint-import-actions.ts  Admin-guarded import + per-player "Pull from Grint" buttons
      realtime.ts            notifySeasonChange broadcast
      photos.ts / tournament.ts
drizzle/                     Generated SQL migrations (committed)
scripts/                     Season setup, Grint tools, test-data seeders, smoke tests
docs/                        tournament-mechanics.md (source of truth for how it plays)
_replit-original/            Reference copy of the original Vite + Express app (pre-migration)
```

## Auth model

Login is **Google SSO first**, with a **PIN fallback** for the few players who don't have a Google account. The separate `admins` table has been retired (admin is now just `players.is_admin`).

- The **landing/login** flow hands off to Supabase Auth's Google provider. On return, `src/app/auth/callback/route.ts` exchanges the code **only to read the verified email**, drops the Supabase session, maps the email to a `players` row, and sets our own signed `bayfield_session` cookie via `iron-session`.
- The session stores **only `playerId`**. Whether someone is an admin is derived from `players.is_admin` on every read — a single source of truth. **An admin is just a player with `is_admin = true`.**
- Emails are **admin-assigned** (`players.email`, unique). A verified Google account with no matching player gets a "not registered" message.
- Every mutation re-derives the caller from the cookie via the guards in `src/lib/server/auth-guards.ts` — no client-supplied `is_admin` flags.
- **PIN fallback:** a subtle link under the Google button opens a **PIN-only** form (`playerLogin` in `src/lib/auth-actions.ts`) — enter the 4-digit PIN and you're in. `players.pin` is **unique**, so a PIN identifies exactly one player; login sets the same `bayfield_session` cookie.
- **PINs are admin-managed and viewable.** Only an admin sets a PIN, in the player editor (players can't self-set one). PINs are stored **in plaintext** so an admin can read/share them — safe because the `players` table has **RLS enabled with no policies** (deny-all for the public publishable key) and the app reads it only via the RLS-bypassing `postgres` connection. Uniqueness is enforced by a DB constraint plus a friendly pre-check (`assertPinUnique`).

## Scoring (in brief)

See [docs/tournament-mechanics.md](./docs/tournament-mechanics.md) for the full picture. The short version:

- **Stroke play (Fri + Sat)** is modeled as **segments** (usually a 9, sometimes an 18), each with its own tee, course rating, slope, and par. Net is `gross − courseHandicap`, computed by the WHS engine in `src/lib/handicap.ts` and **left unrounded** — it is always computed from the stored gross + per-season index, **never stored**.
- **Match play (Sun)** is handicapped: each player's 18-hole course handicap is **rounded**, strokes are allocated by stroke index, and each hole is won by the lower net. From 2026 on, matches are scored from **per-hole grosses**; 2025 was imported as per-hole winners and the engine falls back to those.
- Handicap **indices** and scores can be pulled from TheGrint or entered by hand — same result either way.

## Deployment (Vercel)

Deployed at **[bayfield-open.vercel.app](https://bayfield-open.vercel.app)**. Deploys are done via the Vercel CLI (not git-integrated).

```bash
vercel link
vercel env add DATABASE_URL              # Production
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
vercel env add SUPABASE_SECRET_KEY
vercel env add SESSION_SECRET
# GRINT_COOKIE / GRINT_EMAIL / GRINT_PASSWORD if using Grint pulls in production
vercel deploy --prod
```

If you swap to a different Supabase project, update `next.config.ts` `images.remotePatterns` so `next/image` recognizes the new Storage hostname (currently pinned to the live project).

## Notes for AI tooling

The repo includes an `AGENTS.md` (mirrored at `CLAUDE.md`) with current Next.js 16 guidance. The Supabase agent skill is installed locally via `npx skills add supabase/agent-skills` — its files in `.agents/` are gitignored as per-developer setup.

## Open items

See [TODO.md](./TODO.md) for items deferred during the initial Replit → Next.js migration (notably: `resetTournament` no longer auto-seeds the Day 3 rosters).
