"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AuthState } from "@/types/auth";
import { loadIdentity } from "@/features/identity/server";
import { loadGroup } from "./server";
import {
  text,
  validName,
  validPosition,
  validRequestId,
  validSlug,
  validTimezone,
  canManage,
  mutationError,
} from "./validation";
export async function createGroup(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const name = text(form, "name"),
    slug = text(form, "slug"),
    description = text(form, "description"),
    timezone = text(form, "timezone"),
    request = text(form, "request_id");
  if (
    !validName(name) ||
    !validSlug(slug) ||
    description.length > 1000 ||
    !validTimezone(timezone) ||
    !validRequestId(request)
  )
    return {
      error:
        "Informe nome, identificador válido (3–64 caracteres) e fuso horário válido.",
    };
  const { db } = await loadIdentity();
  let result;
  try {
    result = await db.rpc("create_group_once", {
      p_request_id: request,
      p_name: name,
      p_slug: slug,
      p_description: description,
      p_timezone: timezone,
    });
  } catch {
    return { error: mutationError() };
  }
  if (result.error) return { error: mutationError(result.error.code) };
  revalidatePath("/dashboard");
  redirect(`/groups/${slug}?saved=group`);
}
export async function addGuest(
  slug: string,
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const name = text(form, "name"),
    nickname = text(form, "nickname"),
    position = text(form, "position"),
    request = text(form, "request_id");
  if (
    !validName(name) ||
    nickname.length > 60 ||
    !validPosition(position) ||
    !validRequestId(request)
  )
    return {
      error: "Confira o nome, o apelido (até 60 caracteres) e a posição.",
    };
  const { db, group, role } = await loadGroup(slug);
  if (!canManage(role))
    return {
      error: "Somente administradores deste grupo podem cadastrar convidados.",
    };
  let result;
  try {
    result = await db.rpc("add_guest_once", {
      p_request_id: request,
      p_group_id: group.id,
      p_name: name,
      p_nickname: nickname,
      p_position: position,
    });
  } catch {
    return { error: mutationError() };
  }
  if (result.error) return { error: mutationError(result.error.code) };
  revalidatePath(`/groups/${slug}`);
  redirect(`/groups/${slug}?saved=guest&receipt=${request}`);
}
