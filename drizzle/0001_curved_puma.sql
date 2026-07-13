ALTER TABLE "players" ADD COLUMN "grint_id" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_grintId_unique" UNIQUE("grint_id");