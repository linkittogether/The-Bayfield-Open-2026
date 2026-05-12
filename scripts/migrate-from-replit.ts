import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";
import { db } from "../src/db";
import { admins, players } from "../src/db/schema";

const SOURCE = "https://the-bayfield-open-2026-1--scottgmcmanus.replit.app";

interface SourcePlayer {
  id: number;
  name: string;
  handicap: number;
  photo_url: string | null;
  has_pin: boolean;
}

interface SourceAdmin {
  id: number;
  username: string;
}

async function main() {
  const [{ count: existingPlayers }] = await db
    .select({ count: count() })
    .from(players);
  if (existingPlayers > 0) {
    throw new Error(
      `Refusing to run: players table is not empty (${existingPlayers} rows). Migration is one-shot.`,
    );
  }

  console.log(`Fetching from ${SOURCE} ...`);
  const [pRes, aRes] = await Promise.all([
    fetch(`${SOURCE}/api/players`),
    fetch(`${SOURCE}/api/auth/admins`),
  ]);
  if (!pRes.ok) throw new Error(`players fetch failed: ${pRes.status}`);
  if (!aRes.ok) throw new Error(`admins fetch failed: ${aRes.status}`);

  const sourcePlayers: SourcePlayer[] = await pRes.json();
  const sourceAdmins: SourceAdmin[] = await aRes.json();
  console.log(
    `source: ${sourcePlayers.length} players, ${sourceAdmins.length} admins`,
  );

  // Sentinel hashes — un-loginable until an admin resets the credential.
  // One per pool to avoid 25 expensive bcrypt rounds.
  const playerSentinel = await bcrypt.hash(randomUUID(), 12);
  const adminSentinel = await bcrypt.hash(randomUUID(), 12);

  const playerRows = sourcePlayers.map((p) => ({
    name: p.name,
    handicap: p.handicap,
    photoUrl: null,
    pinHash: playerSentinel,
  }));

  const insertedPlayers = await db
    .insert(players)
    .values(playerRows)
    .returning({ id: players.id, name: players.name });
  console.log(`✓ inserted ${insertedPlayers.length} players`);

  // Skip 'admin' — it's already seeded with the known BAYFIELD2026 code.
  const newAdmins = sourceAdmins.filter((a) => a.username !== "admin");
  if (newAdmins.length > 0) {
    const adminRows = newAdmins.map((a) => ({
      username: a.username,
      codeHash: adminSentinel,
    }));
    const insertedAdmins = await db
      .insert(admins)
      .values(adminRows)
      .onConflictDoNothing({ target: admins.username })
      .returning({ id: admins.id, username: admins.username });
    console.log(
      `✓ inserted ${insertedAdmins.length} admins (skipped 'admin' — already seeded)`,
    );
  }

  console.log("\n⚠ All migrated PINs and admin codes are sentinel — no one can");
  console.log("  log in with them. Reset via the Admin panel:");
  console.log("    • players: edit each row, set a 4-digit PIN");
  console.log("    • admins:  re-add adison/josh/mikep/ryanp with real codes");
  console.log("\nLogin to admin panel as: admin / BAYFIELD2026");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
