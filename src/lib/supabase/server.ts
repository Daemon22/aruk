import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { hasSupabaseConfig, supabasePublicKey, supabaseUrl } from "./config";

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  if (!hasSupabaseConfig()) throw new Error("Supabase Auth is not configured.");
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublicKey(), {
    auth: {
      flowType: "pkce",
      experimental: { passkey: true },
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) cookieStore.set(cookie.name, cookie.value, cookie.options);
      },
    },
  });
}

export function createSupabaseAdminClient(): SupabaseClient {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hasSupabaseConfig() || !secret) {
    throw new Error("Set the server-only Supabase secret key before enabling account deletion.");
  }
  return createClient(supabaseUrl(), secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
