"use server";
import { revalidatePath } from "next/cache";
import { settingsSections } from "@/features/groups/operations/sections";
import { unstable_rethrow } from "next/navigation";
import type { AuthState } from "@/types/auth";
import { loadGroup } from "../server";
import { canManage, validName } from "../validation";
import {
  InputError,
  field,
  identifier,
  parseSchedule,
  parsePricing,
  parseBilling,
  parseEnd,
  periodState,
  todayInTimezone,
  errorMessage,
} from "./validation";
async function context(slug: string, ownerOnly = false) {
  const c = await loadGroup(slug);
  if (!canManage(c.role) || (ownerOnly && c.role !== "owner"))
    throw new InputError(
      ownerOnly
        ? "Somente o proprietário pode alterar preços, vencimentos e vigências."
        : "Somente o proprietário e administradores podem configurar este grupo.",
    );
  return { ...c, today: todayInTimezone(c.group.timezone) };
}
function success(slug: string, message: string): AuthState {
  revalidatePath(`/groups/${slug}/settings`);
  for (const section of settingsSections)
    revalidatePath(`/groups/${slug}/settings/${section.path}`);
  revalidatePath(`/groups/${slug}`);
  return { message };
}
function confirmed(result: { error: unknown; data: unknown }) {
  if (result.error) throw result.error;
  if (!result.data)
    throw new InputError(
      "Nenhum registro foi alterado. Atualize a página e confira seu acesso.",
    );
}
export async function saveSchedule(
  slug: string,
  id: string | null,
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  try {
    const c = await context(slug),
      values = parseSchedule(form);
    if (id) identifier(id);
    if (values.venue_id) {
      const venue = await c.db
        .from("venues")
        .select("id")
        .eq("group_id", c.group.id)
        .eq("id", values.venue_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (venue.error) throw venue.error;
      if (!venue.data)
        throw new InputError("Escolha um local ativo deste grupo.");
    }
    const result = id
      ? await c.db
          .from("group_schedules")
          .update(values)
          .eq("group_id", c.group.id)
          .eq("id", id)
          .select("id")
          .maybeSingle()
      : await c.db
          .from("group_schedules")
          .insert({ ...values, group_id: c.group.id })
          .select("id")
          .single();
    confirmed(result);
    return success(slug, id ? "Agenda atualizada." : "Agenda cadastrada.");
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
export async function deactivateSchedule(
  slug: string,
  id: string,
  previousState: AuthState,
): Promise<AuthState> {
  void previousState;
  try {
    const c = await context(slug);
    identifier(id);
    const result = await c.db
      .from("group_schedules")
      .update({ is_active: false })
      .eq("group_id", c.group.id)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    confirmed(result);
    return success(slug, "Agenda desativada. O histórico foi preservado.");
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
export async function createVenue(
  slug: string,
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  try {
    const c = await context(slug),
      name = field(form, "name"),
      address = field(form, "address");
    if (!validName(name, 120) || address.length > 500)
      throw new InputError(
        "Informe nome (até 120 caracteres) e endereço (até 500).",
      );
    const result = await c.db
      .from("venues")
      .insert({ group_id: c.group.id, name, address: address || null })
      .select("id")
      .single();
    confirmed(result);
    return success(slug, "Local cadastrado.");
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
export async function savePricing(
  slug: string,
  id: string | null,
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  try {
    const c = await context(slug, true),
      values = parsePricing(form, c.today);
    if (id) {
      identifier(id);
      const old = await c.db
        .from("group_pricing_policies")
        .select("effective_from,effective_until")
        .eq("group_id", c.group.id)
        .eq("id", id)
        .maybeSingle();
      confirmed(old);
      if (periodState(old.data!, c.today) !== "future")
        throw new InputError(
          "Uma política iniciada deve ser preservada. Somente versões futuras podem ter valores editados.",
        );
    }
    const result = id
      ? await c.db
          .from("group_pricing_policies")
          .update(values)
          .eq("group_id", c.group.id)
          .eq("id", id)
          .select("id")
          .maybeSingle()
      : await c.db
          .from("group_pricing_policies")
          .insert({ ...values, group_id: c.group.id })
          .select("id")
          .single();
    confirmed(result);
    return success(
      slug,
      id ? "Política futura atualizada." : "Política de preços cadastrada.",
    );
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
export async function saveBilling(
  slug: string,
  id: string | null,
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  try {
    const c = await context(slug),
      values = parseBilling(form, c.today);
    let player = field(form, "player_id");
    if (id) {
      identifier(id);
      const old = await c.db
        .from("member_billing_terms")
        .select("player_id,effective_from,effective_until")
        .eq("group_id", c.group.id)
        .eq("id", id)
        .maybeSingle();
      confirmed(old);
      if (periodState(old.data!, c.today) !== "future")
        throw new InputError(
          "A classificação iniciada é histórica. Somente versões futuras podem ser editadas.",
        );
      player = old.data!.player_id;
    }
    identifier(player);
    const member = await c.db
      .from("group_members")
      .select("role,players(deleted_at)")
      .eq("group_id", c.group.id)
      .eq("player_id", player)
      .eq("status", "active")
      .maybeSingle();
    if (member.error) throw member.error;
    if (!member.data?.players || member.data.players.deleted_at)
      throw new InputError("Selecione um integrante ativo deste grupo.");
    if (member.data.role === "guest" && values.billing_type !== "casual")
      throw new InputError("Convidados devem ser classificados como avulsos.");
    const result = id
      ? await c.db
          .from("member_billing_terms")
          .update(values)
          .eq("group_id", c.group.id)
          .eq("id", id)
          .select("id")
          .maybeSingle()
      : await c.db
          .from("member_billing_terms")
          .insert({ ...values, group_id: c.group.id, player_id: player })
          .select("id")
          .single();
    confirmed(result);
    return success(
      slug,
      id
        ? "Classificação futura atualizada."
        : "Classificação financeira cadastrada.",
    );
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
export async function endPricing(
  slug: string,
  id: string,
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  try {
    const c = await context(slug, true);
    identifier(id);
    const old = await c.db
      .from("group_pricing_policies")
      .select("effective_from,effective_until")
      .eq("group_id", c.group.id)
      .eq("id", id)
      .maybeSingle();
    confirmed(old);
    if (periodState(old.data!, c.today) === "ended")
      throw new InputError("Histórico encerrado não pode ser alterado.");
    const until = parseEnd(form, c.today, old.data!.effective_from);
    const r = await c.db
      .from("group_pricing_policies")
      .update({ effective_until: until })
      .eq("group_id", c.group.id)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    confirmed(r);
    return success(
      slug,
      "Encerramento agendado, sem criação de política substituta.",
    );
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
export async function endBilling(
  slug: string,
  id: string,
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  try {
    const c = await context(slug);
    identifier(id);
    const old = await c.db
      .from("member_billing_terms")
      .select("effective_from,effective_until")
      .eq("group_id", c.group.id)
      .eq("id", id)
      .maybeSingle();
    confirmed(old);
    if (periodState(old.data!, c.today) === "ended")
      throw new InputError("Histórico encerrado não pode ser alterado.");
    const until = parseEnd(form, c.today, old.data!.effective_from);
    const r = await c.db
      .from("member_billing_terms")
      .update({ effective_until: until })
      .eq("group_id", c.group.id)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    confirmed(r);
    return success(
      slug,
      "Encerramento da classificação agendado, sem substituição automática.",
    );
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
