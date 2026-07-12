CREATE TABLE "season_rosters" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"absent" boolean DEFAULT false NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	CONSTRAINT "season_rosters_seasonId_playerId_unique" UNIQUE("season_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"current_day" integer DEFAULT 1 NOT NULL,
	"day1_complete" boolean DEFAULT false NOT NULL,
	"day1_picking_started" boolean DEFAULT false NOT NULL,
	"day1_picking_complete" boolean DEFAULT false NOT NULL,
	"day2_complete" boolean DEFAULT false NOT NULL,
	"day2_draft_complete" boolean DEFAULT false NOT NULL,
	"day3_complete" boolean DEFAULT false NOT NULL,
	"next_picker_rank" integer,
	CONSTRAINT "seasons_year_unique" UNIQUE("year")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name"),
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "day1_scores" ADD COLUMN "season_id" integer;--> statement-breakpoint
ALTER TABLE "day2_teams" ADD COLUMN "season_id" integer;--> statement-breakpoint
ALTER TABLE "day3_matches" ADD COLUMN "season_id" integer;--> statement-breakpoint
ALTER TABLE "season_rosters" ADD CONSTRAINT "season_rosters_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_rosters" ADD CONSTRAINT "season_rosters_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_rosters" ADD CONSTRAINT "season_rosters_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_one_current" ON "seasons" USING btree ("is_current") WHERE "seasons"."is_current";--> statement-breakpoint
ALTER TABLE "day1_scores" ADD CONSTRAINT "day1_scores_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day2_teams" ADD CONSTRAINT "day2_teams_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day3_matches" ADD CONSTRAINT "day3_matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;