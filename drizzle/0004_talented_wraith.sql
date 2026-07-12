ALTER TABLE "day3_players" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_state" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "day3_players" CASCADE;--> statement-breakpoint
DROP TABLE "tournament_state" CASCADE;--> statement-breakpoint
ALTER TABLE "day1_scores" DROP CONSTRAINT "day1_scores_playerId_unique";--> statement-breakpoint
ALTER TABLE "day1_scores" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "day2_teams" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "day3_matches" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "day1_scores" ADD CONSTRAINT "day1_scores_seasonId_playerId_unique" UNIQUE("season_id","player_id");