# Bayfield Open — Golf Tournament App

## Overview
A mobile web app for the Bayfield Open, a 3-day golf tournament.

## Architecture
- **Frontend**: React + Vite + TailwindCSS (in `/client`)
- **Backend**: Express.js REST API (in `/server`)
- **Database**: PostgreSQL (Replit built-in)
- **Startup**: `bash start.sh` launches both concurrently
- **Auth**: PIN-based player login + admin login (username + code)

## Authentication
- Players log in by selecting their name + entering their 4-digit PIN
- Admins log in with username + access code
- Default admin: username `admin`, code `BAYFIELD2026`
- Auth state stored in localStorage
- `AuthContext` at `client/src/contexts/AuthContext.tsx`
- Players can only enter their own Day 1 scores
- Admins can edit any player's handicap or PIN from the Admin panel
- Admins can add/remove other admins

## Logo
- Logo file: `client/public/logo.png`
- CSS `filter: invert(1)` applied for white-on-dark display in header

## Running
- `bash start.sh` — starts API (port 3001) + Vite dev server (port 5000)
- Webview served at port 5000

## Tournament Flow

### Day 1 — Individual
- Players register at `/day1/register` (name, photo, handicap)
- Scores entered at `/day1/scores` (gross score; net = gross - floor(handicap/2))
- Leaderboard at `/day1/leaderboard`
- Partner picking at `/day1/picks` (10th picks first from 11-20, then 9th, etc.)

### Day 2 — Team Play (27 holes, 3 rounds of 9)
- Teams from Day 1 partner picking
- Round scores at `/day2/scores` (per 9 holes, combined net)
- Live leaderboard at `/day2/leaderboard`
- Day 3 draft at `/day2/draft` (winners become captains for Truffle Hogs / Mycelium Syndicate)

### Day 3 — Match Play (Huron Cup)
- Teams: Truffle Hogs vs Mycelium Syndicate
- Match setup at `/day3/setup` (captains assign matchups)
- Per-hole scoring at `/day3/match/:id` (win/loss/tie per hole)
- Live team leaderboard at `/day3/leaderboard`

## Database Tables
- `players` — registration data
- `day1_scores` — individual gross/net scores
- `day2_teams` — partner pairings from Day 1 picks
- `day2_round_scores` — round scores per team
- `day3_players` — Day 3 team assignments
- `day3_matches` — matchup pairings
- `day3_holes` — hole-by-hole results
- `tournament_state` — overall tournament progression

## Key Files
- `server/src/index.js` — Express server entry
- `server/src/routes/` — API route handlers
- `client/src/App.tsx` — React router
- `client/src/lib/api.ts` — API client + TypeScript types
- `client/src/pages/` — All page components
