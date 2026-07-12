CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"grint_course_id" integer,
	CONSTRAINT "courses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "segment_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"segment_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"gross" integer NOT NULL,
	CONSTRAINT "segment_scores_segmentId_playerId_unique" UNIQUE("segment_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"course_id" integer,
	"day" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"label" text NOT NULL,
	"holes" integer DEFAULT 9 NOT NULL,
	"rating" numeric(4, 1),
	"slope" integer,
	"par" integer
);
--> statement-breakpoint
ALTER TABLE "season_rosters" ADD COLUMN "handicap_index" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "segment_scores" ADD CONSTRAINT "segment_scores_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_scores" ADD CONSTRAINT "segment_scores_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;