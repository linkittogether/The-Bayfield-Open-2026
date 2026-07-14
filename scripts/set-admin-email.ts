import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { admins } from "../src/db/schema";

/**
 * Bootstrap: assign a Google email to an admin so they can sign in with Google
 * SSO. Run once (the admin panel can't be reached until at least one admin can
 * log in).
 *
 *   npm run admin:email -- you@gmail.com            # sets admin username "admin"
 *   npm run admin:email -- you@gmail.com someadmin  # sets a specific username
 *   npm run admin:email                             # lists current admins
 */
async function main() {
  const [emailArg, usernameArg] = process.argv.slice(2);
  const username = usernameArg ?? "admin";

  const existing = await db
    .select({ id: admins.id, username: admins.username, email: admins.email })
    .from(admins);

  if (!emailArg) {
    console.log("Current admins:");
    for (const a of existing) {
      console.log(`  - ${a.username}  email=${a.email ?? "(none)"}`);
    }
    console.log("\nPass an email to assign, e.g. npm run admin:email -- you@gmail.com");
    return;
  }

  const email = emailArg.trim().toLowerCase();
  const [updated] = await db
    .update(admins)
    .set({ email })
    .where(eq(admins.username, username))
    .returning({ username: admins.username, email: admins.email });

  if (!updated) {
    console.error(
      `No admin with username "${username}". Existing: ${existing.map((a) => a.username).join(", ") || "(none)"}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${updated.username} email set to ${updated.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
