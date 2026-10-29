import { createHash } from "node:crypto";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthCookieOptions } from "@/lib/supabase/cookies";

// Real installed SDK/SSR storage against a synthetic Auth transport.
// No network, real account, credential, email or provider token is involved.
function harness() {
  const jar = new Map<string, string>();
  const written: { name: string; options: CookieOptions }[] = [];
  const links: { challenge: string; used: boolean }[] = [];
  const tokenCalls: string[] = [];
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
  };
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.${Buffer.alloc(32).toString("base64url")}`;
  const response = (value: object, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: {
        "Content-Type": "application/json",
        "X-Supabase-Api-Version": "2024-01-01",
      },
    });
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (url.includes("/recover")) {
      links.push({ challenge: body.code_challenge, used: false });
      return response({});
    }
    if (url.includes("/token?grant_type=pkce")) {
      tokenCalls.push(body.auth_code);
      const link = links[Number(body.auth_code.replace("fixture-", ""))];
      if (!link || link.used)
        return response(
          { code: "flow_state_not_found", msg: "Consumed synthetic code" },
          400,
        );
      const challenge = createHash("sha256")
        .update(body.code_verifier)
        .digest("base64url");
      if (challenge !== link.challenge)
        return response(
          { code: "bad_code_verifier", msg: "Synthetic mismatch" },
          400,
        );
      link.used = true;
      return response({
        access_token: jwt,
        refresh_token: "synthetic-refresh-fixture",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    }
    throw new Error("Unexpected synthetic Auth route");
  };
  const client = () =>
    createServerClient(
      "https://fixture.supabase.co",
      "sb_publishable_fixture",
      {
        global: { fetch: fetcher },
        cookieOptions: getAuthCookieOptions(),
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (values) =>
            values.forEach(({ name, value, options }) => {
              written.push({ name, options });
              if (options.maxAge === 0) jar.delete(name);
              else jar.set(name, value);
            }),
        },
      },
    );
  const start = async () => {
    const result = await client().auth.resetPasswordForEmail(
      "synthetic@example.test",
      {
        redirectTo: "https://www.borafute.com.br/auth/callback?flow=recovery",
      },
    );
    expect(result.error).toBeNull();
  };
  return { client, start, jar, written, tokenCalls };
}

describe("installed SSR PKCE recovery storage (synthetic Auth)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("persists the verifier before the response and exchanges it in a new SSR client", async () => {
    const h = harness();
    await h.start();
    expect(
      [...h.jar.keys()].some((key) => key.endsWith("-code-verifier")),
    ).toBe(true);
    const result = await h.client().auth.exchangeCodeForSession("fixture-0");
    expect(result.error).toBeNull();
    expect(result.data.session).toBeTruthy();
    expect(h.written.some(({ name }) => name === "sb-fixture-auth-token")).toBe(
      true,
    );
    const verifierCookies = h.written.filter(({ name }) =>
      name.endsWith("-code-verifier"),
    );
    expect(verifierCookies.length).toBeGreaterThan(0);
    for (const { options } of verifierCookies) {
      expect(options.path).toBe("/");
      expect(options.sameSite).toBe("lax");
      expect(options.domain).toBeUndefined();
    }
  });
  it("fails closed when another browser has no verifier", async () => {
    const h = harness();
    await h.start();
    h.jar.clear();
    const result = await h.client().auth.exchangeCodeForSession("fixture-0");
    expect(result.error?.code).toBe("pkce_code_verifier_not_found");
    expect(h.tokenCalls).toHaveLength(0);
  });
  it("reproduces a bad verifier after a second request replaces the shared fallback", async () => {
    const h = harness();
    await h.start();
    await h.start();
    const result = await h.client().auth.exchangeCodeForSession("fixture-0");
    expect(result.error?.code).toBe("bad_code_verifier");
    expect(result.data.session).toBeNull();
  });
  it("does not redeem a recovery code twice", async () => {
    const h = harness();
    await h.start();
    expect(
      (await h.client().auth.exchangeCodeForSession("fixture-0")).error,
    ).toBeNull();
    const reused = await h.client().auth.exchangeCodeForSession("fixture-0");
    expect(reused.error).toBeTruthy();
    expect(reused.data.session).toBeNull();
    expect(h.tokenCalls).toHaveLength(1);
  });
  it("correlates explicit flow ids without borrowing a concurrent verifier", async () => {
    const h = harness();
    await h.start();
    const id = [...h.jar.keys()]
      .map(
        (key) => key.match(/-flow-([A-Za-z0-9_-]{8,64})-code-verifier$/)?.[1],
      )
      .find(Boolean);
    expect(id).toBeTruthy();
    await h.start();
    const first = await h
      .client()
      .auth.exchangeCodeForSession("fixture-0", { flowId: id! });
    expect(first.error).toBeNull();
    const reused = await h
      .client()
      .auth.exchangeCodeForSession("fixture-0", { flowId: id! });
    expect(reused.error?.code).toBe("pkce_code_verifier_not_found");
    expect(h.tokenCalls).toHaveLength(1);
    expect(
      (await h.client().auth.exchangeCodeForSession("fixture-1")).error,
    ).toBeNull();
  });
  it("keeps verifier and session cookies Secure on the HTTPS site", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.borafute.com.br");
    const h = harness();
    await h.start();
    expect(
      (await h.client().auth.exchangeCodeForSession("fixture-0")).error,
    ).toBeNull();
    expect(h.written.length).toBeGreaterThan(0);
    for (const { options } of h.written) {
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe("lax");
      expect(options.domain).toBeUndefined();
    }
  });
});
