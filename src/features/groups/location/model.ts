import { InputError, field, identifier } from "../operations/validation";
export const states =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  );
export type LocationFields = {
  name: string;
  postal_code: string;
  street: string;
  street_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  location_provider: string;
  external_place_id: string;
};
export type LocationRecord = LocationFields & {
  id: string;
  updated_at: string;
  superseded_at: string | null;
};
export type LocationState = {
  ready: boolean;
  primaryId: string | null;
  venues: LocationRecord[];
};
export const emptyLocation: LocationFields = {
  name: "",
  postal_code: "",
  street: "",
  street_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  latitude: "",
  longitude: "",
  location_provider: "",
  external_place_id: "",
};
export function coordinate(value: string, min: number, max: number) {
  const s = value.trim().replace(",", ".");
  if (!s) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))
    throw new InputError("Informe coordenadas válidas.");
  const n = Number(s);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new InputError("Coordenadas fora do limite.");
  return n;
}
export function parseLocation(form: FormData) {
  const text = (key: string, max: number) => {
    const v = field(form, key);
    if (v.length > max || /[\u0000-\u001f\u007f]/.test(v))
      throw new InputError("Confira os campos e seus limites de tamanho.");
    return v;
  };
  const name = text("name", 120),
    street = text("street", 200),
    city = text("city", 120),
    state = text("state", 2).toUpperCase();
  const latitude = coordinate(field(form, "latitude"), -90, 90),
    longitude = coordinate(field(form, "longitude"), -180, 180);
  if ((latitude === null) !== (longitude === null))
    throw new InputError("Informe latitude e longitude juntas.");
  if (
    !name ||
    !(
      (street && city && states.includes(state)) ||
      (latitude !== null && longitude !== null)
    )
  )
    throw new InputError(
      "Informe o nome e um endereço com logradouro, cidade e UF, ou um par de coordenadas.",
    );
  if (state && !states.includes(state))
    throw new InputError("Selecione uma UF válida.");
  const postal = text("postal_code", 9).replace(/-/g, "");
  if (postal && !/^\d{8}$/.test(postal))
    throw new InputError("Informe um CEP válido de oito dígitos.");
  const provider = text("location_provider", 30),
    external = text("external_place_id", 512);
  if ((provider || external) && !(provider === "geoapify" && external))
    throw new InputError(
      "Referência externa inválida. Remova a seleção e tente novamente.",
    );
  const venue = field(form, "venue_id"),
    expected = field(form, "expected_primary_id"),
    version = field(form, "expected_updated_at");
  if (venue) identifier(venue);
  if (expected) identifier(expected);
  if (venue && (!version || !Number.isFinite(Date.parse(version))))
    throw new InputError("Recarregue o local antes de editar.");
  if (!venue && version)
    throw new InputError("Versão inválida. Recarregue a página.");
  return {
    p_name: name,
    p_postal_code: postal,
    p_street: street,
    p_street_number: text("street_number", 30),
    p_complement: text("complement", 120),
    p_neighborhood: text("neighborhood", 120),
    p_city: city,
    p_state: state,
    ...(latitude !== null && longitude !== null
      ? { p_latitude: latitude, p_longitude: longitude }
      : {}),
    ...(provider
      ? { p_location_provider: provider, p_external_place_id: external }
      : {}),
    ...(venue
      ? { p_venue_id: venue, p_expected_venue_updated_at: version }
      : {}),
    ...(expected ? { p_expected_primary_venue_id: expected } : {}),
  };
}
export function locationLinks(value: LocationFields) {
  let lat: number | null, lon: number | null;
  try {
    lat = coordinate(value.latitude, -90, 90);
    lon = coordinate(value.longitude, -180, 180);
  } catch {
    return null;
  }
  const address = [
    value.street,
    value.street_number,
    value.neighborhood,
    value.city,
    value.state,
    value.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const point = lat !== null && lon !== null;
  if (!point && !address) return null;
  const navigation = new URL("https://www.google.com/maps/dir/");
  navigation.searchParams.set("api", "1");
  navigation.searchParams.set("destination", point ? `${lat},${lon}` : address);
  let map: string | undefined;
  if (point) {
    const u = new URL("https://www.openstreetmap.org/export/embed.html");
    u.searchParams.set(
      "bbox",
      `${Math.max(-180, lon! - 0.005)},${Math.max(-90, lat! - 0.005)},${Math.min(180, lon! + 0.005)},${Math.min(90, lat! + 0.005)}`,
    );
    u.searchParams.set("marker", `${lat},${lon}`);
    u.searchParams.set("layer", "mapnik");
    map = u.toString();
  }
  return { navigation: navigation.toString(), map };
}
export function locationError(error: unknown) {
  if (error instanceof InputError) return error.message;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : null;
  if (code === "40001" || code === "40P01")
    return "O local foi alterado ou está em uso. Recarregue a página antes de tentar novamente.";
  if (code === "23505")
    return "Já existe um local com esse nome ou referência. Selecione o cadastro existente para editar.";
  if (code === "42501")
    return "Você não tem permissão para alterar o local deste grupo.";
  if (code === "23503") return "Escolha um local atual deste grupo.";
  if (code === "23514" || code === "23502")
    return "Confira o endereço, as coordenadas e a integridade do local.";
  return "Não foi possível confirmar a gravação. Recarregue e confira o principal antes de tentar novamente.";
}
