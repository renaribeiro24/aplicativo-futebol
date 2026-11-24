"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { AuthState } from "@/types/auth";
import { loadManagedGroup } from "@/features/groups/server";
import { getSiteOrigin } from "@/features/auth/validation";
import { text } from "@/features/groups/validation";
import { memberClient } from "./server";
import {
  emailValid,
  normalizeRecipient,
  tokenValid,
  uuidValid,
  invitationUrl,
  memberError,
} from "./validation";
export type MemberActionState = AuthState & { link?: string };
export async function manageMember(
  slug: string,
  _: MemberActionState,
  form: FormData,
): Promise<MemberActionState> {
  const context = await loadManagedGroup(slug);
  const db = await memberClient();
  const operation = text(form, "operation");
  const id = text(form, "id");
  if (operation === "role" || operation === "status") {
    if (!uuidValid(id)) return { error: "Integrante inválido." };
    const value = text(form, "value");
    if (
      operation === "role" &&
      (context.role !== "owner" || !["player", "admin"].includes(value))
    )
      return { error: memberError("42501") };
    if (operation === "status" && value !== "suspended")
      return { error: "O retorno exige novo convite individual." };
    const result =
      operation === "role"
        ? await db.rpc("set_member_role", {
            p_group_id: context.group.id,
            p_member_id: id,
            p_role: value,
          })
        : await db.rpc("set_member_status", {
            p_group_id: context.group.id,
            p_member_id: id,
            p_status: value,
          });
    if (result.error) return { error: memberError(result.error.code) };
  } else {
    let payload: Record<string, string | number | null> = {};
    let request: string | undefined;
    let link: string | undefined;
    if (operation === "create_invitation" || operation === "create_link") {
      request = text(form, "request_id");
      const raw = text(form, "token");
      if (!uuidValid(request) || !tokenValid(raw))
        return { error: "Atualize o formulário e tente novamente." };
      const origin = getSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
      if (!origin) return { error: "A URL pública não está configurada." };
      link = invitationUrl(
        origin,
        operation === "create_invitation" ? "individual" : "shared",
        raw,
      );
      payload.token_hash = createHash("sha256").update(raw).digest("hex");
      if (operation === "create_invitation") {
        const email = normalizeRecipient(text(form, "email"));
        const delivery = text(form, "delivery");
        if (!emailValid(email) || !["manual", "automatic"].includes(delivery))
          return {
            error: "Informe e-mail e forma de compartilhamento válidos.",
          };
        payload = { ...payload, email, delivery };
      } else {
        const label = text(form, "label");
        const max = text(form, "max_uses");
        if (
          label.length < 1 ||
          label.length > 80 ||
          (max && !/^[1-9][0-9]{0,7}$/.test(max))
        )
          return { error: "Confira a descrição e o limite opcional." };
        payload = { ...payload, label, max_uses: max ? Number(max) : null };
      }
    } else if (
      ["revoke_invitation", "revoke_link", "review", "billing"].includes(
        operation,
      )
    ) {
      if (!uuidValid(id)) return { error: "Registro inválido." };
      payload.id = id;
      if (operation === "review") {
        const decision = text(form, "decision");
        if (!["approve", "reject"].includes(decision))
          return { error: "Decisão inválida." };
        payload.decision = decision;
      }
      if (operation === "billing") {
        const type = text(form, "type"),
          from = text(form, "from");
        if (
          !["monthly", "casual"].includes(type) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(from)
        )
          return { error: "Informe modalidade e data válidas." };
        payload = { ...payload, type, from };
      }
    } else return { error: "Operação inválida." };
    const result = await db.rpc("member_command", {
      p_operation: operation,
      p_group_id: context.group.id,
      p_request_id: request,
      p_payload: payload,
    });
    if (result.error) return { error: memberError(result.error.code) };
    if (link) {
      revalidatePath("/groups/" + slug);
      revalidatePath("/groups/" + slug + "/members");
      revalidatePath("/groups/" + slug + "/settings/members");
      return {
        link,
        message:
          operation === "create_invitation" && payload.delivery === "automatic"
            ? "Convite preparado. Nenhum e-mail foi enviado: o envio automático está desativado nesta etapa. Compartilhe o link abaixo."
            : "Link preparado. Copie agora: o token não é armazenado e não poderá ser recuperado depois.",
      };
    }
  }
  revalidatePath("/groups/" + slug);
      revalidatePath("/groups/" + slug + "/members");
      revalidatePath("/groups/" + slug + "/settings/members");
  return { message: "Operação confirmada e salva." };
}
export async function processAdmission(
  kind: "individual" | "shared",
  operation: "preview" | "accept" | "request",
  _: MemberActionState,
  form: FormData,
): Promise<MemberActionState> {
  const db = await memberClient();
  const token = text(form, "token");
  if (
    !tokenValid(token) ||
    !["individual", "shared"].includes(kind) ||
    (kind === "individual" && operation === "request") ||
    (kind === "shared" && operation === "accept")
  )
    return { error: "Link inválido." };
  const result = await db.rpc("member_command", {
    p_operation: operation,
    p_payload: {
      kind,
      token_hash: createHash("sha256").update(token).digest("hex"),
    },
  });
  if (result.error) return { error: memberError(result.error.code) };
  // No token, provider detail or external redirect is returned.
  if (operation === "preview") {
    const value = result.data;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof value.group === "string"
    )
      return {
        message:
          "Convite para " + value.group + ". Confirme abaixo para continuar.",
      };
    return {
      message:
        "Este convite já foi aceito por esta conta. Consulte seu dashboard.",
    };
  }
  revalidatePath("/dashboard");
  return {
    message:
      operation === "accept"
        ? "Convite aceito. Você entrou como Jogador e Avulso. Abra o dashboard."
        : "Solicitação registrada. Aguarde a aprovação de um gestor; ela ainda não concede acesso ao grupo.",
  };
}
