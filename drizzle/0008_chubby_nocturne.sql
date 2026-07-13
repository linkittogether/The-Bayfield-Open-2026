CREATE TABLE "course_holes" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"tee" text NOT NULL,
	"hole_number" integer NOT NULL,
	"par" integer,
	"stroke_index" integer,
	CONSTRAINT "course_holes_courseId_tee_holeNumber_unique" UNIQUE("course_id","tee","hole_number")
);
--> statement-breakpoint
ALTER TABLE "day3_holes" ALTER COLUMN "winner" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "day3_holes" ADD COLUMN "truffle_player_gross" integer;--> statement-breakpoint
ALTER TABLE "day3_holes" ADD COLUMN "syndicate_player_gross" integer;--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN "tee" text;--> statement-breakpoint
ALTER TABLE "course_holes" ADD CONSTRAINT "course_holes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;