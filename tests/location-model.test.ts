import { describe, it, expect } from "vitest";
import {
  parseLocation,
  coordinate,
  locationLinks,
  emptyLocation,
  locationError,
} from "@/features/groups/location/model";
const form = (values: Record<string, string> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    name: "Campo sintético",
    street: "Rua sintética",
    city: "Cidade",
    state: "SP",
    ...values,
  }))
    f.set(k, v);
  return f;
};
describe("location validation and navigation", () => {
  it("supports manual address without inventing unavailable components", () => {
    const p = parseLocation(form());
    expect(p.p_postal_code).toBe("");
    expect(p.p_street_number).toBe("");
    expect(p).not.toHaveProperty("p_latitude");
    expect(p).not.toHaveProperty("p_location_provider");
  });
  it("accepts a named coordinate point with no invented address", () => {
    const p = parseLocation(
      form({ street: "", city: "", state: "", latitude: "0", longitude: "0" }),
    );
    expect(p.p_latitude).toBe(0);
    expect(p.p_longitude).toBe(0);
  });
  it.each<Record<string, string>>([
    { name: "" },
    { street: "" },
    { state: "XX" },
    { postal_code: "123" },
    { latitude: "91", longitude: "0" },
    { latitude: "1", longitude: "" },
    { latitude: "Infinity", longitude: "0" },
    { latitude: "0x10", longitude: "1" },
    { location_provider: "other", external_place_id: "x" },
    { location_provider: "geoapify", external_place_id: "" },
    { name: "a".repeat(121) },
    { external_place_id: "secret\nvalue", location_provider: "geoapify" },
  ])("rejects invalid fields", (v) =>
    expect(() => parseLocation(form(v))).toThrow(),
  );
  it("normalizes CEP, UF and Brazilian decimal coordinates", () => {
    const p = parseLocation(
      form({
        postal_code: "01310-100",
        state: "sp",
        latitude: "-23,5",
        longitude: "-46,5",
      }),
    );
    expect(p.p_postal_code).toBe("01310100");
    expect(p.p_state).toBe("SP");
    expect(p.p_latitude).toBe(-23.5);
  });
  it("ignores forged tenant, role and timezone", () => {
    const p = parseLocation(
      form({ group_id: "foreign", role: "owner", timezone: "UTC" }),
    );
    expect(p).not.toHaveProperty("p_group_id");
    expect(p).not.toHaveProperty("role");
    expect(p).not.toHaveProperty("timezone");
  });
  it("retains the exact optimistic timestamp precision", () => {
    const stamp = "2026-11-13T12:00:00.123456+00:00";
    const p = parseLocation(
      form({
        venue_id: "00000000-0000-4000-8000-000000000001",
        expected_primary_id: "00000000-0000-4000-8000-000000000001",
        expected_updated_at: stamp,
      }),
    );
    expect(p.p_expected_venue_updated_at).toBe(stamp);
  });
  it("rejects an edit without a version", () =>
    expect(() =>
      parseLocation(form({ venue_id: "00000000-0000-4000-8000-000000000001" })),
    ).toThrow());
  it("uses only fixed HTTPS navigation/map origins and escaped address input", () => {
    const links = locationLinks({
      ...emptyLocation,
      street: "<script> x & y",
      city: "Cidade",
    });
    expect(new URL(links!.navigation).origin).toBe("https://www.google.com");
    expect(links!.navigation).not.toContain("<script>");
    expect(links!.map).toBeUndefined();
    const point = locationLinks({
      ...emptyLocation,
      latitude: "0",
      longitude: "0",
    });
    expect(new URL(point!.map!).origin).toBe("https://www.openstreetmap.org");
    expect(new URL(point!.navigation).searchParams.get("destination")).toBe(
      "0,0",
    );
  });
  it("does not build links for invalid or empty locations", () => {
    expect(locationLinks(emptyLocation)).toBeNull();
    expect(
      locationLinks({
        ...emptyLocation,
        latitude: "javascript:bad",
        longitude: "0",
      }),
    ).toBeNull();
    expect(coordinate("", -90, 90)).toBeNull();
  });
  it("sanitizes internal errors and distinguishes conflicts", () => {
    expect(locationError({ code: "40001" })).toContain("Recarregue");
    expect(locationError({ code: "40P01" })).toContain("Recarregue");
    expect(locationError(Error("private token"))).not.toContain(
      "private token",
    );
  });
});
