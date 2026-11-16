import "server-only";
import { emptyLocation, states, type LocationFields } from "./model";
export type Suggestion = LocationFields & { label: string };
export function searchConfigured() {
  return (
    Boolean(process.env.GEOAPIFY_API_KEY) &&
    process.env.GEOAPIFY_STORAGE_APPROVED === "1"
  );
}
const object = (x: unknown): Record<string, unknown> | null =>
  typeof x === "object" && x !== null && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null;
export function normalizeSuggestions(payload: unknown): Suggestion[] {
  const root = object(payload);
  if (!Array.isArray(root?.results)) throw Error("Invalid provider format");
  return root.results.slice(0, 6).flatMap((value: unknown) => {
    const p = object(value);
    if (!p || object(p.datasource)?.sourcename !== "openstreetmap") return [];
    const text = (key: string, max = 200) =>
      typeof p[key] === "string"
        ? p[key]
            .replace(/[\u0000-\u001f\u007f]/g, "")
            .trim()
            .slice(0, max)
        : "";
    const lat = p.lat,
      lon = p.lon;
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180 ||
      text("country_code").toLowerCase() !== "br"
    )
      return [];
    const id = text("place_id", 513);
    if (!id || id.length > 512) return [];
    const state = text("state_code").toUpperCase().replace(/^BR-/, "");
    const postal = text("postcode").replace(/-/g, "");
    return [
      {
        ...emptyLocation,
        name:
          text("name", 120) ||
          text("address_line1", 120) ||
          text("street", 120),
        street: text("street", 200),
        street_number: text("housenumber", 30),
        neighborhood: text("suburb", 120) || text("district", 120),
        city: text("city", 120) || text("town", 120) || text("village", 120),
        state: states.includes(state) ? state : "",
        postal_code: /^\d{8}$/.test(postal) ? postal : "",
        latitude: String(lat),
        longitude: String(lon),
        location_provider: "geoapify",
        external_place_id: id,
        label: text("formatted", 500) || text("address_line1", 500),
      },
    ];
  });
}
export async function boundedText(response: Response, limit = 100000) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw Error("Body too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(bytes);
}
export async function searchLocations(query: string): Promise<Suggestion[]> {
  if (!searchConfigured()) throw Error("Provider disabled");
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  for (const [k, v] of Object.entries({
    text: query,
    format: "json",
    limit: "6",
    lang: "pt",
    filter: "countrycode:br",
    apiKey: process.env.GEOAPIFY_API_KEY!,
  }))
    url.searchParams.set(k, v);
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(4000),
  });
  if (
    !response.ok ||
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  )
    throw Error("Provider unavailable");
  return normalizeSuggestions(JSON.parse(await boundedText(response)));
}
