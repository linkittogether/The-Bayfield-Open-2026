import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cookie-bound server Supabase client. Only used in the OAuth callback route to
// exchange the auth code for a session (so we can read the verified Google email).
// After we read the email we sign out again — iron-session is the app's session
// of record, not Supabase.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a context where cookies can't be set (e.g. a Server
            // Component). Safe to ignore — the callback route can always set them.
          }
        },
      },
    },
  );
}
