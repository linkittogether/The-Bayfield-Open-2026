ALTER TABLE "admins" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_email_unique" UNIQUE("email");