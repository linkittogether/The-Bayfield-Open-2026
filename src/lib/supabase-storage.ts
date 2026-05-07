import { createClient } from "@supabase/supabase-js";

// Server-only client for Storage uploads. Uses the secret key, never ship to the browser.
export const supabaseStorage = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
