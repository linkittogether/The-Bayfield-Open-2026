"use server";

import { redirect } from "next/navigation";
import { getSession } from "./session";
import { createSupabaseServerClient } from "./supabase/server";

// Login is Google SSO only (see src/app/auth/callback/route.ts). The old
// PIN / username+code login was retired along with the admins table.

export async function logout() {
  // Clear any lingering Supabase auth cookies (defensive — iron-session is the
  // session of record, but a callback may have left Supabase cookies behind).
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // No Supabase session / cookies not writable here — safe to ignore.
  }

  const session = await getSession();
  session.destroy();
  redirect("/login");
}
