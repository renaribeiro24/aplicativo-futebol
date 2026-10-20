import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/features/auth/session";
import { validName } from "@/features/groups/validation";
export async function loadIdentity() {
  const user = await requireUser();
  const db = await createClient();
  // Metadata supplies presentation only. Roles always come from active DB membership.
  const supplied = user.user_metadata?.display_name;
  const name =
    typeof supplied === "string" && validName(supplied.trim())
      ? supplied.trim()
      : "Jogador";
  const prepared = await db.rpc("ensure_my_identity", { p_display_name: name });
  if (prepared.error)
    throw new Error(
      "Não foi possível preparar seu perfil. Atualize a página para tentar novamente.",
    );
  const [profile, player] = await Promise.all([
    db.from("profiles").select("id,display_name").eq("id", user.id).single(),
    db
      .from("players")
      .select("id,name,nickname,preferred_position")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single(),
  ]);
  if (profile.error || player.error)
    throw new Error(
      "Seu perfil está temporariamente indisponível. Tente novamente.",
    );
  return { user, db, profile: profile.data, player: player.data };
}
