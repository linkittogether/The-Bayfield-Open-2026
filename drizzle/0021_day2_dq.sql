ALTER TABLE "day2_teams" ADD COLUMN "disqualified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "day2_teams" ADD COLUMN "dq_reason" text;