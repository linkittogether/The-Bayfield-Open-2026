import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client, used only to kick off the Google OAuth redirect from
// the login page. Uses the publishable (public) key.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
