import "server-only";
import { canManage } from "../validation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database as LocationDatabase } from "@/types/database.location.types";
import type { loadManagedGroup } from "../server";
import type { LocationState, LocationRecord } from "./model";
export async function readLocationState(
  context: Awaited<ReturnType<typeof loadManagedGroup>>,
): Promise<LocationState> {
  if (!canManage(context.role)) notFound();
  const db = await createClient<LocationDatabase>();
  const [g, v] = await Promise.all([
    db
      .from("groups")
      .select("primary_venue_id")
      .eq("id", context.group.id)
      .is("deleted_at", null)
      .maybeSingle(),
    db
      .from("venues")
      .select(
        "id,name,postal_code,street,street_number,complement,neighborhood,city,state,latitude,longitude,location_provider,external_place_id,superseded_at,updated_at",
      )
      .eq("group_id", context.group.id)
      .is("deleted_at", null)
      .order("name")
      .limit(1000),
  ]);
  const errors = [g.error, v.error].filter(Boolean);
  if (
    errors.length &&
    errors.every((e) => e && ["42703", "PGRST204", "PGRST202"].includes(e.code))
  )
    return { ready: false, primaryId: null, venues: [] };
  if (errors.length || !g.data || !v.data)
    throw Error("Não foi possível consultar a localização do grupo.");
  const convert = (row: (typeof v.data)[number]): LocationRecord => ({
    id: row.id,
    name: row.name,
    updated_at: row.updated_at,
    superseded_at: row.superseded_at,
    postal_code: row.postal_code ?? "",
    street: row.street ?? "",
    street_number: row.street_number ?? "",
    complement: row.complement ?? "",
    neighborhood: row.neighborhood ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    latitude: row.latitude === null ? "" : String(row.latitude),
    longitude: row.longitude === null ? "" : String(row.longitude),
    location_provider: row.location_provider ?? "",
    external_place_id: row.external_place_id ?? "",
  });
  const venues = v.data.map(convert);
  const primaryId = g.data.primary_venue_id;
  if (primaryId && !venues.some((x) => x.id === primaryId)) {
    const primary = await db
      .from("venues")
      .select("*")
      .eq("group_id", context.group.id)
      .eq("id", primaryId)
      .is("deleted_at", null)
      .single();
    if (primary.error || !primary.data)
      throw Error("Não foi possível consultar o local principal.");
    venues.push(convert(primary.data));
  }
  return { ready: true, primaryId, venues };
}
