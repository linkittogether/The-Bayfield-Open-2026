-- Enable Row Level Security on every public table with NO policies (deny-all).
--
-- The app never touches these tables through the Supabase API: all reads/writes
-- go through a direct Postgres connection as the `postgres` role (rolbypassrls),
-- and Realtime uses public Broadcast channels (not postgres_changes). So the
-- anon/authenticated roles (i.e. anyone holding the public publishable key) have
-- no legitimate table access — deny everything. RLS is ENABLED (not FORCED), so
-- the bypassing app role is unaffected; adding a policy later can grant scoped
-- API access if ever needed.

ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_holes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "day2_teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "day3_holes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "day3_matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "season_rosters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "segment_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "segments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
