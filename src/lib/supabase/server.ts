import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "./config";
export async function createClient() {
  const store = await cookies();
  const { url, key } = requireSupabaseConfig();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components are read-only; src/proxy.ts persists refresh cookies. */
        }
      },
    },
  });
}
