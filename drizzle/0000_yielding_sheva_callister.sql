CREATE TYPE "public"."hole_winner" AS ENUM('truffle_hogs', 'mycelium_syndicate', 'tie');--> statement-breakpoint
CREATE TYPE "public"."team_name" AS ENUM('truffle_hogs', 'mycelium_syndicate');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"code_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "day1_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"gross_score" integer NOT NULL,
	"net_score" integer NOT NULL,
	CONSTRAINT "day1_scores_playerId_unique" UNIQUE("player_id")
);
--> statement-breakpoint
CREATE TABLE "day2_round_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"round_number" integer NOT NULL,
	"player1_gross" integer NOT NULL,
	"player2_gross" integer NOT NULL,
	"net_score" integer NOT NULL,
	CONSTRAINT "day2_round_scores_teamId_roundNumber_unique" UNIQUE("team_id","round_number")
);
--> statement-breakpoint
CREATE TABLE "day2_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"player1_id" integer NOT NULL,
	"player2_id" integer NOT NULL,
	"pick_order" integer NOT NULL,
	"name" text
);
--> statement-breakpoint
CREATE TABLE "day3_holes" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"hole_number" integer NOT NULL,
	"winner" "hole_winner" NOT NULL,
	CONSTRAINT "day3_holes_matchId_holeNumber_unique" UNIQUE("match_id","hole_number")
);
--> statement-breakpoint
CREATE TABLE "day3_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_number" integer NOT NULL,
	"truffle_player_id" integer NOT NULL,
	"syndicate_player_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day3_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"team_name" "team_name" NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	CONSTRAINT "day3_players_playerId_unique" UNIQUE("player_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"photo_url" text,
	"handicap" integer DEFAULT 0 NOT NULL,
	"pin_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"current_day" integer DEFAULT 1 NOT NULL,
	"day1_complete" boolean DEFAULT false NOT NULL,
	"day1_picking_started" boolean DEFAULT false NOT NULL,
	"day1_picking_complete" boolean DEFAULT false NOT NULL,
	"day2_complete" boolean DEFAULT false NOT NULL,
	"day2_draft_complete" boolean DEFAULT false NOT NULL,
	"day3_complete" boolean DEFAULT false NOT NULL,
	"next_picker_rank" integer
);
--> statement-breakpoint
ALTER TABLE "day1_scores" ADD CONSTRAINT "day1_scores_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day2_round_scores" ADD CONSTRAINT "day2_round_scores_team_id_day2_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."day2_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day2_teams" ADD CONSTRAINT "day2_teams_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day2_teams" ADD CONSTRAINT "day2_teams_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day3_holes" ADD CONSTRAINT "day3_holes_match_id_day3_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."day3_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day3_matches" ADD CONSTRAINT "day3_matches_truffle_player_id_players_id_fk" FOREIGN KEY ("truffle_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day3_matches" ADD CONSTRAINT "day3_matches_syndicate_player_id_players_id_fk" FOREIGN KEY ("syndicate_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day3_players" ADD CONSTRAINT "day3_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;