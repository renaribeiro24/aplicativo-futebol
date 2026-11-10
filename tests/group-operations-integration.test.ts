import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
const m = vi.hoisted(() => ({ load: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/features/groups/server", () => ({ loadGroup: m.load }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
import {
  saveSchedule,
  savePricing,
  saveBilling,
} from "@/features/groups/operations/actions";
const group = "00000000-0000-4000-8000-000000000001",
  record = "00000000-0000-4000-8000-000000000002",
  player = "00000000-0000-4000-8000-000000000003";
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
const calls: {
  url: URL;
  method: string;
  body: Record<string, unknown> | null;
}[] = [];
let mode = "schedule";
const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    ),
    method = init?.method ?? "GET";
  calls.push({
    url,
    method,
    body: init?.body ? JSON.parse(String(init.body)) : null,
  });
  let payload: unknown = { id: record },
    status = 200;
  if (mode === "overlap") {
    payload = {
      code: "23P01",
      message: "private PostgreSQL detail",
      details: null,
      hint: null,
    };
    status = 409;
  } else if (method === "GET" && url.pathname.endsWith("member_billing_terms"))
    payload = [
      {
        player_id: player,
        effective_from: "2026-11-16",
        effective_until: null,
      },
    ];
  else if (method === "GET" && url.pathname.endsWith("group_members"))
    payload = [{ role: "player", players: { deleted_at: null } }];
  else if (method === "POST") status = 201;
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
});
describe("server actions + real SDK integration over synthetic HTTP transport (not JWT/RLS evidence)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    vi.clearAllMocks();
    calls.length = 0;
    mode = "schedule";
    const db = createClient<Database>(
      "https://example.invalid",
      "sb_publishable_test",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch: fetcher },
      },
    );
    m.load.mockResolvedValue({
      db,
      group: { id: group, timezone: "UTC" },
      role: "owner",
    });
  });
  afterEach(() => vi.useRealTimers());
  it("serializes only the server-authorized group and expected schedule columns", async () => {
    const result = await saveSchedule(
      "alpha",
      null,
      {},
      form({
        weekday: "1",
        starts_at_local: "19:00",
        duration_minutes: "90",
        recurrence_type: "biweekly",
        starts_on: "2026-11-16",
        is_active: "on",
        group_id: "forged",
        role: "owner",
      }),
    );
    expect(result.message).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toMatchObject({
      group_id: group,
      duration_minutes: 90,
      interval_weeks: 2,
    });
    expect(calls[0].body).not.toHaveProperty("role");
  });
  it("maps a real PostgREST-shaped overlap response without leaking details or confirming success", async () => {
    mode = "overlap";
    const result = await savePricing(
      "alpha",
      null,
      {},
      form({
        monthly_enabled: "on",
        monthly_amount: "80,01",
        due_day: "10",
        effective_from: "2026-11-16",
      }),
    );
    expect(result.error).toContain("vigência");
    expect(result.message).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("private PostgreSQL");
    expect(m.revalidate).not.toHaveBeenCalled();
  });
  it("sends tenant filters on lookup and PATCH and never transfers a member", async () => {
    const result = await saveBilling(
      "alpha",
      record,
      {},
      form({
        player_id: "forged",
        billing_type: "monthly",
        effective_from: "2026-11-16",
      }),
    );
    expect(result.message).toBeTruthy();
    expect(calls).toHaveLength(3);
    for (const c of calls)
      expect(c.url.searchParams.get("group_id")).toBe(`eq.${group}`);
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url.searchParams.get("id")).toBe(`eq.${record}`);
    expect(patch.body).not.toHaveProperty("player_id");
    expect(calls[1].url.searchParams.get("player_id")).toBe(`eq.${player}`);
  });
});
