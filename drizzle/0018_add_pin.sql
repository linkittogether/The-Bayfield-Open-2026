ALTER TABLE "players" ADD COLUMN "pin" text;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_pin_unique" UNIQUE("pin");