# The Bayfield Open

Mobile-first web app for the Bayfield Open — a 3-day golf tournament. Players register with a 4-digit PIN, enter their own scores, and follow live leaderboards across Day 1 (individual handicap scoring), Day 2 (partner play, 27 holes), and Day 3 (Truffle Hogs vs Mycelium Syndicate match play for the Huron Cup).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind v4 + [shadcn/ui](https://ui.shadcn.com) (Radix primitives) |
| Database | Supabase Postgres via Drizzle ORM (`postgres-js` driver, `prepare: false` for the transaction pooler) |
| Storage | Supabase Storage (`players` bucket) for player photos |
| Auth | Custom PIN/code login with bcrypt hashes + `iron-session` signed cookies |
| Hosting | Vercel (Server Actions, `bodySizeLimit: 6mb` for photo uploads) |

## Prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier is fine) — needed for Postgres + Storage

## First-time setup

```bash
git clone git@github.com:linkittogether/The-Bayfield-Open-2026.git
cd The-Bayfield-Open-2026
npm install
```

### Environment

Copy the template and fill in values from your Supabase dashboard:

```bash
cp .env.example .env.local
```

What goes where:

| Var | Where to find it | Notes |
|---|---|---|
| `DATABASE_URL` | Project Settings → Database → Connection string → **Transaction** mode (port 6543) | Pooled connection. Required for serverless. |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API → Publishable key (`sb_publishable_…`) | Browser-safe |
| `SUPABASE_SECRET_KEY` | Project Settings → API → Secret key (`sb_secret_…`) | Server-only. Used for Storage uploads. |
| `SESSION_SECRET` | Generate with `openssl rand -hex 32` | Signs the auth cookie |

### Database

```bash
npm run db:migrate     # Apply all migrations to Supabase
npm run db:seed        # Insert default admin (admin / BAYFIELD2026) + tournament_state row
npm run storage:setup  # Create the public `players` storage bucket
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `admin` / `BAYFIELD2026`.

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
npm run db:seed          # Seed default admin + tournament_state

# Supabase Storage
npm run storage:setup    # Create/update the `players` bucket (idempotent)

# Replit migration (one-shot)
npm run migrate:replit   # Pull roster from the live Replit deployment
```

## Project layout

```
src/
  app/                       App Router pages
    (login, day1, day2, day3, admin pages)
  components/                Layout, AuthButton, BottomNav, PlayerAvatar
    ui/                      shadcn-generated components
  db/
    schema.ts                Drizzle table definitions
    index.ts                 db client
    seed.ts                  Default admin + tournament_state
  lib/
    auth-actions.ts          login / logout Server Actions
    session.ts               iron-session helpers, getCurrentUser, requireAdmin/Player/etc.
    format.ts                netScore9, ordinal, initials, firstName
    supabase-storage.ts      Storage client (server, secret-key)
    server/                  Domain Server Actions
      auth-guards.ts         requireAdmin / requireAdminOrSelf / requireAdminOrTeamMember / requireAdminOrMatchPlayer
      players.ts             Player CRUD + createPlayerFromForm/updatePlayerFromForm wrappers
      admins.ts              Admin CRUD (with `admin` user protected from deletion)
      tournament.ts          State get/update/reset
      day1.ts                Leaderboard, score upsert (gross − ⌊handicap/2⌋), partner picks
      day2.ts                Teams, round score upsert, leaderboard, draft
      day3.ts                Matches, hole-by-hole scoring, leaderboard, complete
      photos.ts              uploadPlayerPhoto / deletePlayerPhoto
drizzle/                     Generated SQL migrations (committed)
scripts/                     One-off scripts (smoke tests, storage setup, Replit migration)
_replit-original/            Reference copy of the original Vite + Express app (kept until migration is signed off)
```

## Auth model

Auth is custom — no Supabase Auth — because the tournament UX is "select your name from a list, enter a 4-digit PIN" rather than email / OAuth.

- PINs and admin codes are hashed with bcrypt (12 rounds) and stored in `players.pin_hash` / `admins.code_hash`
- Login Server Actions verify the hash and set a signed `bayfield_session` cookie via `iron-session`
- Every mutation re-derives the caller's identity from that cookie via the guards in `src/lib/server/auth-guards.ts` — no client-supplied `is_admin` flags

## Tournament flow

1. **Day 1** — individual play. Each player enters a gross score; net = gross − ⌊handicap/2⌋. Leaderboard ranks by net (gross as tiebreaker).
2. **Partner picks** — once 20 players have scores, the 10th-ranked player picks first from ranks 11–20, then 9th, down to 1st.
3. **Day 2** — partner play, 3 rounds of 9 holes. Combined net per round; team total ranked.
4. **Day 3 draft** — Truffle Hogs and Mycelium Syndicate teams (10 each) with named captains.
5. **Day 3 setup + match play** — captains pair matches; each match is hole-by-hole win/loss/tie. Team that wins more holes wins the match. Most match wins takes the Huron Cup.

## Deployment (Vercel)

```bash
vercel link
vercel env add DATABASE_URL              # Production
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
vercel env add SUPABASE_SECRET_KEY
vercel env add SESSION_SECRET
vercel deploy --prod
```

If you swap to a different Supabase project, update `next.config.ts` `images.remotePatterns` so `next/image` recognizes the new hostname.

## Notes for AI tooling

The repo includes an `AGENTS.md` (mirrored at `CLAUDE.md`) with current Next.js 16 guidance. The Supabase agent skill is installed locally via `npx skills add supabase/agent-skills` — its files in `.agents/` are gitignored as they're per-developer setup.

## Open items

See [TODO.md](./TODO.md) for migration items deferred during the initial port (notably: `resetTournament` no longer auto-seeds the Day 3 rosters).
