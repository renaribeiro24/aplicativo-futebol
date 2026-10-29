import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
// React.cache deduplicates within a render, never across user requests.
export const getCurrentUser = cache(async () => {
  if (!getSupabaseConfig()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
