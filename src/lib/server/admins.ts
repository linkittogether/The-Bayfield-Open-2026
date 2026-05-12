"use server";

import bcrypt from "bcryptjs";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { requireAdmin } from "./auth-guards";

const upsertSchema = z.object({
  username: z.string().trim().min(1),
  code: z.string().min(1),
});

export async function listAdmins() {
  await requireAdmin();
  return db
    .select({
      id: admins.id,
      username: admins.username,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(asc(admins.username));
}

export async function upsertAdmin(input: z.input<typeof upsertSchema>) {
  await requireAdmin();
  const data = upsertSchema.parse(input);
  const codeHash = await bcrypt.hash(data.code, 12);

  const [row] = await db
    .insert(admins)
    .values({ username: data.username, codeHash })
    .onConflictDoUpdate({ target: admins.username, set: { codeHash } })
    .returning({
      id: admins.id,
      username: admins.username,
      createdAt: admins.createdAt,
    });
  return row;
}

export async function deleteAdmin(id: number) {
  await requireAdmin();
  const result = await db
    .delete(admins)
    .where(and(eq(admins.id, id), ne(admins.username, "admin")));
  return { rowsAffected: result.count };
}
