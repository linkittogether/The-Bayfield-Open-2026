ALTER TABLE "players" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Carry existing admin identities onto their player rows before the admins table
-- is retired (next migration): match by SSO email, then by legacy username → name.
UPDATE "players" SET "is_admin" = true
WHERE "email" IS NOT NULL
  AND lower("email") IN (SELECT lower("email") FROM "admins" WHERE "email" IS NOT NULL);--> statement-breakpoint
UPDATE "players" SET "is_admin" = true
WHERE lower(regexp_replace("name", '\s+', '', 'g')) IN (SELECT lower("username") FROM "admins");
