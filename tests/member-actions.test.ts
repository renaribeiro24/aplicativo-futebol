import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  managed: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/features/members/server", () => ({
  memberClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/features/groups/server", () => ({
  loadManagedGroup: mocks.managed,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
import { manageMember, processAdmission } from "@/features/members/actions";
const id = "11111111-1111-4111-8111-111111111111";
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [key, value] of Object.entries(values)) f.set(key, value);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.managed.mockResolvedValue({ role: "owner", group: { id } });
  mocks.rpc.mockResolvedValue({ data: { id }, error: null });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.invalid");
});
afterEach(() => vi.unstubAllEnvs());
describe("member server actions (mocked, no remote Auth)", () => {
  it("binds tenant from server context", async () => {
    await manageMember(
      "synthetic",
      {},
      form({ operation: "revoke_link", id, group_id: "foreign" }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "member_command",
      expect.objectContaining({ p_group_id: id }),
    );
  });
  it("rejects malformed identifier before RPC", async () => {
    expect(
      await manageMember(
        "synthetic",
        {},
        form({ operation: "status", id: "bad", value: "suspended" }),
      ),
    ).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("blocks direct reactivation", async () => {
    expect(
      await manageMember(
        "synthetic",
        {},
        form({ operation: "status", id, value: "active" }),
      ),
    ).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("blocks admin promotion", async () => {
    mocks.managed.mockResolvedValue({ role: "admin", group: { id } });
    expect(
      await manageMember(
        "synthetic",
        {},
        form({ operation: "role", id, value: "admin" }),
      ),
    ).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("hashes token and normalizes recipient", async () => {
    const raw = "a".repeat(64);
    const state = await manageMember(
      "synthetic",
      {},
      form({
        operation: "create_invitation",
        request_id: id,
        token: raw,
        email: "A@EXAMPLE.INVALID",
        delivery: "manual",
      }),
    );
    expect(state.link).toBe(
      "https://example.invalid/admissoes/individual#token=" + raw,
    );
    const args = mocks.rpc.mock.calls[0][1];
    expect(args.p_payload.email).toBe("a@example.invalid");
    expect(args.p_payload.token_hash).not.toBe(raw);
    expect(JSON.stringify(args)).not.toContain(raw);
  });
  it("does not claim success after RPC rejection", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "PRIVATE_PROVIDER_DETAILS" },
    });
    const state = await manageMember(
      "synthetic",
      {},
      form({ operation: "revoke_link", id }),
    );
    expect(state.message).toBeUndefined();
    expect(state.error).not.toContain("PRIVATE");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("schema missing fails closed", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect(
      (
        await manageMember(
          "synthetic",
          {},
          form({ operation: "revoke_link", id }),
        )
      ).error,
    ).toContain("Nenhuma alteração foi salva");
  });
  it("rejects unknown delivery mode", async () => {
    await manageMember(
      "synthetic",
      {},
      form({
        operation: "create_invitation",
        request_id: id,
        token: "a".repeat(64),
        email: "a@example.invalid",
        delivery: "bypass",
      }),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("automatic option explicitly reports no email sent", async () => {
    expect(
      (
        await manageMember(
          "synthetic",
          {},
          form({
            operation: "create_invitation",
            request_id: id,
            token: "a".repeat(64),
            email: "a@example.invalid",
            delivery: "automatic",
          }),
        )
      ).message,
    ).toContain("Nenhum e-mail foi enviado");
  });
  it("acceptance sends only hash and kind, ignores supplied role/user", async () => {
    const raw = "b".repeat(64);
    await processAdmission(
      "individual",
      "accept",
      {},
      form({ token: raw, user_id: "foreign", role: "owner" }),
    );
    expect(mocks.rpc.mock.calls[0][1].p_payload).toEqual({
      kind: "individual",
      token_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(raw);
  });
  it("shared link cannot directly admit", async () => {
    expect(
      await processAdmission(
        "shared",
        "accept",
        {},
        form({ token: "b".repeat(64) }),
      ),
    ).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("pending request never claims access", async () => {
    expect(
      (
        await processAdmission(
          "shared",
          "request",
          {},
          form({ token: "b".repeat(64) }),
        )
      ).message,
    ).toContain("ainda não concede acesso");
  });
  it("refreshes both member entry points after persistence", async () => {
    await manageMember("synthetic", {}, form({ operation: "revoke_link", id }));
    expect(mocks.refresh).toHaveBeenCalledWith("/groups/synthetic/members");
    expect(mocks.refresh).toHaveBeenCalledWith(
      "/groups/synthetic/settings/members",
    );
  });
});
