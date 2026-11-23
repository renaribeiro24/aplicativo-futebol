import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.members.types";
import { requireUser } from "@/features/auth/session";
import { loadGroup } from "@/features/groups/server";
import { parseMemberData } from "./model";
import { memberError } from "./validation";
export async function memberClient() {
  await requireUser();
  return createClient<Database>();
}
export async function loadMembers(slug: string) {
  const context = await loadGroup(slug);
  const db = await memberClient();
  const { data, error } = await db.rpc("member_command", {
    p_operation: "data",
    p_group_id: context.group.id,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883")
      return { ...context, members: null };
    throw Error(memberError());
  }
  return { ...context, members: parseMemberData(data) };
}
