import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import {
  normalizeSuggestions,
  searchConfigured,
  searchLocations,
  boundedText,
} from "@/features/groups/location/provider";
const result = {
  country_code: "br",
  datasource: { sourcename: "openstreetmap" },
  name: "Campo sintético",
  formatted: "Endereço sintético",
  lat: -23.5,
  lon: -46.5,
  place_id: "synthetic-place",
  state_code: "BR-SP",
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Geoapify adapter, synthetic transport only", () => {
  it("normalizes POI and leaves unavailable fields blank", () => {
    const p = normalizeSuggestions({ results: [result] })[0];
    expect(p.name).toBe("Campo sintético");
    expect(p.state).toBe("SP");
    expect(p.postal_code).toBe("");
    expect(p.street_number).toBe("");
    expect(p.external_place_id).toBe("synthetic-place");
    expect(p.location_provider).toBe("geoapify");
  });
  it("filters foreign, invalid geometry and unhandled attribution sources", () => {
    expect(
      normalizeSuggestions({
        results: [
          { ...result, country_code: "us" },
          { ...result, lat: 91 },
          { ...result, datasource: { sourcename: "other" } },
        ],
      }),
    ).toEqual([]);
  });
  it("rejects malformed envelopes", () =>
    expect(() => normalizeSuggestions({ features: [] })).toThrow());
  it("requires both key and storage activation before external calls", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "synthetic-test-key");
    vi.stubEnv("GEOAPIFY_STORAGE_APPROVED", "0");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(searchConfigured()).toBe(false);
    await expect(searchLocations("campo")).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
  it("uses a fixed endpoint, no-store, timeout, country filter and whitelist output", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "synthetic-test-key");
    vi.stubEnv("GEOAPIFY_STORAGE_APPROVED", "1");
    const f = vi.fn(async () =>
      Response.json({ results: [{ ...result, private_extra: "ignore" }] }),
    );
    vi.stubGlobal("fetch", f);
    const results = await searchLocations("Campo sintético");
    const [url, opts] = f.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.origin).toBe("https://api.geoapify.com");
    expect(url.searchParams.get("filter")).toBe("countrycode:br");
    expect(opts.cache).toBe("no-store");
    expect(opts.redirect).toBe("error");
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    expect(results[0]).not.toHaveProperty("private_extra");
  });
  it("does not expose upstream errors/URL through its own error", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "synthetic-test-key");
    vi.stubEnv("GEOAPIFY_STORAGE_APPROVED", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "private upstream value" }, { status: 401 }),
      ),
    );
    await expect(searchLocations("campo")).rejects.toThrow(
      "Provider unavailable",
    );
  });
  it("bounds input and provider response bodies", async () => {
    await expect(
      boundedText(new Response("a".repeat(1025)), 1024),
    ).rejects.toThrow("Body too large");
    expect(await boundedText(new Response("São Paulo"), 100)).toBe("São Paulo");
  });
});
