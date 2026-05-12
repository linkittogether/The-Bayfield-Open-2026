# Migration TODOs

Open items deferred during the Replit → Next.js + Supabase migration. Mention these in the migration PR description.

## resetTournament: Day 3 team auto-seed dropped

The original Express `POST /api/tournament/reset` did two things: (1) cleared all scores/teams/matches/holes and reset the state flags, then (2) re-populated `day3_players` from a hardcoded list of player names ("Truffle Hogs" + "Mycelium Syndicate" with named captains).

The hardcoded re-population had what looked like a name-mismatch bug: the captain was looked up as `'Josh W'` while the team roster appeared to use `'Josh Wright'`. After fetching live data from the Replit deployment, the actual stored player name is `'Josh W'`, so against the real dataset the captain lookup *would* have matched — the bug existed in the explorer's reading of the source, not the running code. The auto-seed itself is still gone from `resetTournament`; the trade-off below stands.

**What changed:** the new `resetTournament` in `src/lib/server/tournament.ts` only does step (1) — clears tournament data and resets state. The team auto-seed is gone.

**Decision pending:** how to restore the auto-seed.
- Option A: port as-is, preserve the bug (faithful migration).
- Option B: port with the bug fixed (`Josh W` → `Josh Wright` in the captain lookup, or rename the roster entry to `Josh W`).
- Option C: leave reset as a clean wipe and add a separate admin action `seedDay3Teams()` that captains/players are loaded into via UI, not hardcoded.

Recommendation: **C**. Hardcoding 20 player names in server code is brittle for a tool that might run more than one tournament; seeding belongs in the admin UI.
