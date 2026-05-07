import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { admins } from "../src/db/schema";

async function main() {
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, "admin"))
    .limit(1);

  if (!admin) throw new Error("seeded admin not found");

  const goodMatch = await bcrypt.compare("BAYFIELD2026", admin.codeHash);
  const badMatch = await bcrypt.compare("WRONG", admin.codeHash);

  console.log("correct code matches:", goodMatch);
  console.log("wrong code matches:  ", badMatch);

  if (!goodMatch || badMatch) {
    throw new Error("bcrypt round-trip failed");
  }
  console.log("bcrypt smoke test PASS");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
