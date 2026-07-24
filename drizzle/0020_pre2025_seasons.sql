ALTER TABLE "season_rosters" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "match_play" boolean DEFAULT true NOT NULL;