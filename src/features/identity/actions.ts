"use server";
import { revalidatePath } from "next/cache";
import { loadIdentity } from "./server";
import { text, validName, validPosition } from "@/features/groups/validation";
import type { AuthState } from "@/types/auth";
export async function saveProfile(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const display = text(form, "display_name"),
    name = text(form, "name"),
    nickname = text(form, "nickname"),
    position = text(form, "position");
  if (
    !validName(display) ||
    !validName(name) ||
    nickname.length > 60 ||
    !validPosition(position)
  )
    return { error: "Confira os nomes, o apelido e a posição." };
  const { db } = await loadIdentity();
  try {
    const result = await db.rpc("save_my_identity", {
      p_display_name: display,
      p_name: name,
      p_nickname: nickname,
      p_position: position,
    });
    if (result.error)
      return {
        error:
          "Não foi possível salvar. Nenhum campo foi alterado; tente novamente.",
      };
  } catch {
    return {
      error:
        "Não foi possível confirmar a atualização. Repetir os mesmos dados é seguro.",
    };
  }
  revalidatePath("/", "layout");
  return { message: "Perfil atualizado com sucesso." };
}
