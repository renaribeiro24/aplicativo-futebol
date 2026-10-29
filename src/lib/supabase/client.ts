import { getAuthCookieOptions } from "./cookies";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { requireSupabaseConfig } from "./config";
export function createClient() {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient<Database>(url, key, {
    cookieOptions: getAuthCookieOptions(),
  });
}
