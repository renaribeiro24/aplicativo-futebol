"use server";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database as LocationDatabase } from "@/types/database.location.types";
import type { AuthState } from "@/types/auth";
import { loadManagedGroup } from "../server";
import { identifier } from "../operations/validation";
import { parseLocation, locationError } from "./model";
import { readLocationState } from "./server";
export async function savePrimaryLocation(
  slug: string,
  previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  void previous;
  try {
    const context = await loadManagedGroup(slug);
    // Capability check is automatic, read-only, and fails closed on the old schema.
    if (!(await readLocationState(context)).ready)
      return {
        error:
          "A atualização do banco para local principal ainda aguarda autorização. Nenhum local foi gravado.",
      };
    const values = parseLocation(form);
    const db = await createClient<LocationDatabase>();
    const result = await db.rpc("save_group_primary_venue", {
      ...values,
      p_group_id: context.group.id,
    });
    if (result.error) throw result.error;
    if (typeof result.data !== "string")
      throw Error("Missing persistence confirmation");
    identifier(result.data);
    revalidatePath(`/groups/${slug}/settings/general`);
    revalidatePath(`/groups/${slug}/settings/schedule`);
    revalidatePath(`/groups/${slug}/settings`);
    revalidatePath(`/groups/${slug}`);
    return {
      message:
        "Local principal salvo. Agendas e partidas anteriores foram preservadas.",
    };
  } catch (error) {
    unstable_rethrow(error);
    return { error: locationError(error) };
  }
}
