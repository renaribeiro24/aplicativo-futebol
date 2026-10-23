import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  identity: vi.fn(),
  group: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/features/identity/server", () => ({ loadIdentity: m.identity }));
vi.mock("@/features/groups/server", () => ({ loadGroup: m.group }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error(`redirect:${path}`);
  },
}));
import { createGroup, addGuest } from "@/features/groups/actions";
import { saveProfile } from "@/features/identity/actions";
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
const request = "00000000-0000-4000-8000-000000000001";
describe("authenticated mutations (SDK mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.identity.mockResolvedValue({ db: { rpc: m.rpc } });
    m.group.mockResolvedValue({
      db: { rpc: m.rpc },
      group: { id: "group-a" },
      role: "owner",
    });
    m.rpc.mockResolvedValue({ data: "result", error: null });
  });
  it("does not submit invalid groups", async () => {
    expect(
      (await createGroup({}, form({ name: "", slug: "x" }))).error,
    ).toBeTruthy();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("uses an idempotent RPC with a stable request and redirects outside the catch", async () => {
    await expect(
      createGroup(
        {},
        form({
          name: "Alpha",
          slug: "alpha",
          description: "",
          timezone: "America/Sao_Paulo",
          request_id: request,
        }),
      ),
    ).rejects.toThrow("redirect:/groups/alpha?saved=group");
    expect(m.rpc).toHaveBeenCalledWith(
      "create_group_once",
      expect.objectContaining({ p_request_id: request }),
    );
  });
  it("reports slug conflicts", async () => {
    m.rpc.mockResolvedValue({ error: { code: "23505" } });
    expect(
      (
        await createGroup(
          {},
          form({
            name: "Alpha",
            slug: "alpha",
            description: "",
            timezone: "America/Sao_Paulo",
            request_id: request,
          }),
        )
      ).error,
    ).toContain("identificador");
  });
  it("rejects unauthorized guest administration even if a form is forged", async () => {
    m.group.mockResolvedValue({ role: "player", group: { id: "a" } });
    expect(
      (
        await addGuest(
          "alpha",
          {},
          form({ name: "Guest", request_id: request }),
        )
      ).error,
    ).toContain("administradores");
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("sends only permitted guest fields to the group-bound RPC", async () => {
    await expect(
      addGuest(
        "alpha",
        {},
        form({
          name: "Guest",
          position: "defender",
          request_id: request,
          user_id: "forged",
        }),
      ),
    ).rejects.toThrow("redirect:/groups/alpha?saved=guest");
    expect(m.rpc).toHaveBeenCalledWith("add_guest_once", {
      p_request_id: request,
      p_group_id: "group-a",
      p_name: "Guest",
      p_nickname: "",
      p_position: "defender",
    });
  });
  it("writes own profile without accepting IDs or administrative fields", async () => {
    expect(
      (
        await saveProfile(
          {},
          form({
            display_name: "Display",
            name: "Sport",
            nickname: "",
            position: "forward",
            user_id: "other",
            role: "owner",
          }),
        )
      ).message,
    ).toBeTruthy();
    expect(m.rpc).toHaveBeenCalledWith("save_my_identity", {
      p_display_name: "Display",
      p_name: "Sport",
      p_nickname: "",
      p_position: "forward",
    });
  });
});
