import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  recovery: vi.fn(),
  update: vi.fn(),
  user: vi.fn(),
  exchange: vi.fn(),
  resend: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: m.signIn,
      signUp: m.signUp,
      resetPasswordForEmail: m.recovery,
      updateUser: m.update,
      getUser: m.user,
      exchangeCodeForSession: m.exchange,
      resend: m.resend,
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error(`redirect:${path}`);
  },
}));
import {
  login,
  signup,
  requestPasswordReset,
  resetPassword,
  resendConfirmation,
} from "@/features/auth/actions";
import { GET } from "@/app/auth/callback/route";
import { NextRequest } from "next/server";
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
describe("Auth flows (provider mocked; not real JWTs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.test");
    m.signIn.mockResolvedValue({ error: null });
    m.signUp.mockResolvedValue({ data: { session: null }, error: null });
    m.recovery.mockResolvedValue({ error: null });
    m.user.mockResolvedValue({
      data: { user: { id: "fixture" } },
      error: null,
    });
    m.update.mockResolvedValue({ error: null });
    m.exchange.mockResolvedValue({ error: null });
    m.resend.mockResolvedValue({ error: null });
  });
  it("logs in with a password without putting a destination under user control", async () => {
    await expect(
      login(
        {},
        form({
          email: "a@b.test",
          password: "fixture-pass",
          next: "https://evil.test",
        }),
      ),
    ).rejects.toThrow("redirect:/dashboard");
  });
  it("respects email confirmation enabled on the actual provider", async () => {
    const r = await signup(
      {},
      form({ name: "Display", email: "a@b.test", password: "fixture-pass" }),
    );
    expect(r.message).toContain("Confirme");
    expect(m.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          emailRedirectTo: "https://app.test/auth/callback",
          data: { display_name: "Display" },
        },
      }),
    );
  });
  it("accepts a session when provider confirmation is disabled", async () => {
    m.signUp.mockResolvedValue({
      data: { session: { fixture: true } },
      error: null,
    });
    await expect(
      signup(
        {},
        form({ name: "Display", email: "a@b.test", password: "fixture-pass" }),
      ),
    ).rejects.toThrow("redirect:/dashboard");
  });
  it("requests a fixed recovery destination and generic message", async () => {
    const r = await requestPasswordReset(
      {},
      form({ email: "a@b.test", redirectTo: "https://evil.test" }),
    );
    expect(r.message).toContain("Se houver");
    expect(m.recovery).toHaveBeenCalledWith("a@b.test", {
      redirectTo: "https://app.test/auth/callback?flow=recovery",
    });
  });
  it("does not update a password with an expired session", async () => {
    m.user.mockResolvedValue({
      data: { user: null },
      error: { code: "expired" },
    });
    expect(
      (
        await resetPassword(
          {},
          form({ password: "fixture-pass", confirmation: "fixture-pass" }),
        )
      ).error,
    ).toContain("expirou");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("rejects confirmation mismatch", async () => {
    expect(
      (
        await resetPassword(
          {},
          form({ password: "fixture-pass", confirmation: "different" }),
        )
      ).error,
    ).toBeTruthy();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("changes only the password of a server-verified user", async () => {
    await expect(
      resetPassword(
        {},
        form({ password: "fixture-pass", confirmation: "fixture-pass" }),
      ),
    ).rejects.toThrow("redirect:/dashboard?notice=password");
    expect(m.update).toHaveBeenCalledWith({ password: "fixture-pass" });
  });
  it("drops arbitrary callback redirects and marks responses private", async () => {
    const r = await GET(
      new NextRequest(
        "https://app.test/auth/callback?code=fixture&next=https://evil.test",
      ),
    );
    expect(r.headers.get("location")).toBe("https://app.test/dashboard");
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("uses the configured origin even when the request host is untrusted", async () => {
    const r = await GET(
      new NextRequest("https://untrusted.test/auth/callback?code=fixture"),
    );
    expect(r.headers.get("location")).toBe("https://app.test/dashboard");
  });
  it("fails closed if the callback origin is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const r = await GET(
      new NextRequest("https://app.test/auth/callback?code=fixture"),
    );
    expect(r.status).toBe(503);
    expect(m.exchange).not.toHaveBeenCalled();
  });
  it("resends confirmation through Auth with a fixed callback", async () => {
    const r = await resendConfirmation({}, form({ email: "a@b.test" }));
    expect(r.message).toContain("aguardando confirmação");
    expect(m.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "a@b.test",
      options: { emailRedirectTo: "https://app.test/auth/callback" },
    });
  });
  it("handles expired recovery codes", async () => {
    m.exchange.mockResolvedValue({ error: { code: "expired" } });
    const r = await GET(
      new NextRequest(
        "https://app.test/auth/callback?code=fixture&flow=recovery",
      ),
    );
    expect(r.headers.get("location")).toBe(
      "https://app.test/forgot-password?error=expired",
    );
  });
});
