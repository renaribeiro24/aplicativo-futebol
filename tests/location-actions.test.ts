import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.location.types";
const m = vi.hoisted(() => ({
  managed: vi.fn(),
  client: vi.fn(),
  state: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/groups/server", () => ({ loadManagedGroup: m.managed }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("@/features/groups/location/server", () => ({
  readLocationState: m.state,
}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (e: unknown) => {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") throw e;
  },
}));
import { savePrimaryLocation } from "@/features/groups/location/actions";
const group = "00000000-0000-4000-8000-000000000001",
  venue = "00000000-0000-4000-8000-000000000002";
const body = () => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    name: "Campo sintético",
    street: "Rua",
    city: "Cidade",
    state: "SP",
    group_id: "forged",
    timezone: "UTC",
    role: "owner",
  }))
    f.set(k, v);
  return f;
};
let outcome: unknown = venue,
  status = 200;
const transport = vi.fn(
  async () =>
    new Response(JSON.stringify(outcome), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
);
beforeEach(() => {
  vi.clearAllMocks();
  status = 200;
  outcome = venue;
  m.state.mockResolvedValue({ ready: true, primaryId: null, venues: [] });
  m.managed.mockResolvedValue({ role: "owner", group: { id: group } });
  m.client.mockResolvedValue(
    createClient<Database>(
      "https://example.invalid",
      "sb_publishable_synthetic",
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: transport },
      },
    ),
  );
});
afterEach(() => vi.restoreAllMocks());
describe("location action + actual SDK over synthetic HTTP (not Auth/JWT)", () => {
  it.each(["owner", "admin"])(
    "saves %s through RPC with the server tenant only",
    async (role) => {
      m.managed.mockResolvedValue({ role, group: { id: group } });
      expect(
        (await savePrimaryLocation("alpha", {}, body())).message,
      ).toBeTruthy();
      const [url, options] = transport.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(new URL(url).pathname).toBe(
        "/rest/v1/rpc/save_group_primary_venue",
      );
      const payload = JSON.parse(String(options.body));
      expect(payload.p_group_id).toBe(group);
      expect(payload).not.toHaveProperty("timezone");
      expect(payload).not.toHaveProperty("role");
      expect(m.revalidate).toHaveBeenCalledWith(
        "/groups/alpha/settings/general",
      );
    },
  );
  it("does not call RPC on the old schema", async () => {
    m.state.mockResolvedValue({ ready: false });
    expect((await savePrimaryLocation("alpha", {}, body())).error).toContain(
      "autorização",
    );
    expect(transport).not.toHaveBeenCalled();
  });
  it("validates before calling RPC", async () => {
    const f = body();
    f.set("latitude", "91");
    f.set("longitude", "1");
    expect((await savePrimaryLocation("alpha", {}, f)).error).toBeTruthy();
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(["player", "guest", "foreign"])(
    "preserves the guard for %s",
    async () => {
      m.managed.mockRejectedValue(Error("NEXT_NOT_FOUND"));
      await expect(savePrimaryLocation("alpha", {}, body())).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it.each([
    { data: null, status: 200 },
    {
      data: { code: "42501", message: "sensitive upstream detail" },
      status: 403,
    },
    { data: { code: "40001" }, status: 409 },
    { data: "not-a-uuid", status: 200 },
  ])(
    "never reports success on failed or invalid confirmation",
    async (entry) => {
      status = entry.status;
      outcome = entry.data;
      const r = await savePrimaryLocation("alpha", {}, body());
      expect(r.error).toBeTruthy();
      expect(r.message).toBeUndefined();
      expect(r.error).not.toContain("sensitive upstream");
      expect(m.revalidate).not.toHaveBeenCalled();
    },
  );
});
