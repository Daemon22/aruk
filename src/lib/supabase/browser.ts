"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabasePublicKey, supabaseUrl } from "./config";

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (!hasSupabaseConfig()) return null;
  browserClient ??= createBrowserClient(supabaseUrl(), supabasePublicKey(), {
    auth: {
      flowType: "pkce",
      experimental: { passkey: true },
    },
  });
  return browserClient;
}
