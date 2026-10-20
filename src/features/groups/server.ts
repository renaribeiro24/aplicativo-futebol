import "server-only";
import { notFound } from "next/navigation";
import { loadIdentity } from "@/features/identity/server";
import { validSlug } from "./validation";
export async function loadGroup(slug: string) {
  if (!validSlug(slug)) notFound();
  const identity = await loadIdentity();
  const result = await identity.db
    .from("groups")
    .select("id,name,slug,description,timezone")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (result.error)
    throw new Error("Não foi possível consultar o grupo. Tente novamente.");
  if (!result.data) notFound();
  const membership = await identity.db
    .from("group_members")
    .select("role")
    .eq("group_id", result.data.id)
    .eq("player_id", identity.player.id)
    .eq("status", "active")
    .maybeSingle();
  if (membership.error)
    throw new Error("Não foi possível verificar seu vínculo.");
  if (!membership.data) notFound();
  return { ...identity, group: result.data, role: membership.data.role };
}
