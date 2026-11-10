import { describe, expect, it, vi } from "vitest";
import { PROJECT_URL } from "../scripts/stage0042-http-guards.mjs";
import {
  classifyProbe,
  PROBES,
  authenticatedReadPreflight,
  READ_TABLES,
} from "../scripts/stage0042-preflight.mjs";
const dataUrl = PROJECT_URL + PROBES[1][1],
  authUrl = PROJECT_URL + PROBES[0][1];
const denial = {
  code: "42501",
  message: "permission denied for table groups",
  details: null,
  hint: null,
};
function response(
  body: unknown,
  status = 401,
  url = dataUrl,
  contentType = "application/json",
  redirected = false,
) {
  const r = new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
  Object.defineProperty(r, "url", { value: url });
  Object.defineProperty(r, "redirected", { value: redirected });
  return r;
}
describe("004.2 anonymous reachability classification (offline responses)", () => {
  it("recognizes only the pinned PostgreSQL denial as reachable, not authenticated authorization", async () => {
    const result = await classifyProbe("data_api", dataUrl, response(denial));
    expect(result).toMatchObject({
      status: 401,
      code: "42501",
      category: "anonymous_access_denied",
      connectivityConfirmed: true,
      authorizationConfirmed: false,
      canAuthenticate: true,
    });
    expect(JSON.stringify(result)).not.toContain("message");
  });
  it("accepts the expected Auth health service", async () => {
    expect(
      await classifyProbe(
        "auth",
        authUrl,
        response({ name: "GoTrue", version: "v2.test" }, 200, authUrl),
      ),
    ).toMatchObject({
      connectivityConfirmed: true,
      authorizationConfirmed: false,
      canAuthenticate: true,
    });
  });
  it.each([
    { message: "Invalid API key" },
    { code: "PGRST301", message: "JWT expired" },
    { code: "PGRST303", message: "JWT invalid" },
    { code: "invalid_api_key" },
    { ...denial, message: "permission denied for table players" },
    { ...denial, code: 42501 },
    { code: "42501", message: denial.message },
    { ...denial, details: "sensitive upstream information" },
  ])(
    "blocks arbitrary auth/gateway/permission errors without disclosing the body",
    async (body) => {
      const result = await classifyProbe("data_api", dataUrl, response(body));
      expect(result.canAuthenticate).toBe(false);
      expect(result.authorizationConfirmed).toBe(false);
      expect(JSON.stringify(result)).not.toContain("sensitive upstream");
    },
  );
  it.each([
    "https://proxy.invalid/rest/v1/groups?select=id&limit=0",
    PROJECT_URL + "/auth/v1/token",
    PROJECT_URL + "/rest/v1/",
    "",
  ])("rejects wrong response URL %s", async (url) => {
    expect(
      (await classifyProbe("data_api", dataUrl, response(denial, 401, url)))
        .canAuthenticate,
    ).toBe(false);
  });
  it("rejects redirection even when the final URL is expected", async () => {
    expect(
      (
        await classifyProbe(
          "data_api",
          dataUrl,
          response(denial, 401, dataUrl, "application/json", true),
        )
      ).canAuthenticate,
    ).toBe(false);
  });
  it("rejects an untrusted request origin", async () => {
    expect(
      (
        await classifyProbe(
          "data_api",
          "https://proxy.invalid/rest/v1/groups",
          response(denial),
        )
      ).canAuthenticate,
    ).toBe(false);
  });
  it("does not accept HTML from a proxy as PostgreSQL", async () => {
    expect(
      (
        await classifyProbe(
          "data_api",
          dataUrl,
          response(denial, 401, dataUrl, "text/html"),
        )
      ).category,
    ).toBe("non_json_response");
  });
  it("blocks malformed JSON", async () => {
    const r = new Response("broken", {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    Object.defineProperty(r, "url", { value: dataUrl });
    expect((await classifyProbe("data_api", dataUrl, r)).canAuthenticate).toBe(
      false,
    );
  });
  it("blocks unexpected anonymous 200 rather than blessing wider permissions", async () => {
    expect(
      await classifyProbe("data_api", dataUrl, response([], 200)),
    ).toMatchObject({
      category: "unexpected_anonymous_read_access",
      connectivityConfirmed: true,
      canAuthenticate: false,
      authorizationConfirmed: false,
    });
  });
  it.each([403, 404, 500])(
    "does not relax the known response contract for status %s",
    async (status) => {
      expect(
        (await classifyProbe("data_api", dataUrl, response(denial, status)))
          .canAuthenticate,
      ).toBe(false);
    },
  );
  it("does not accept a generic health 200 without the expected service identity", async () => {
    expect(
      (
        await classifyProbe(
          "auth",
          authUrl,
          response({ ok: true }, 200, authUrl),
        )
      ).canAuthenticate,
    ).toBe(false);
  });
});
describe("authenticated read barrier before all fixture creation", () => {
  it("requires all six read operations for each of A, B and C", async () => {
    const probe = vi.fn(async () => ({ status: 200, data: [], error: null }));
    const pass = vi.fn();
    await authenticatedReadPreflight(probe, pass);
    expect(probe).toHaveBeenCalledTimes(18);
    expect(pass).toHaveBeenCalledTimes(18);
    for (const actor of ["A", "B", "C"])
      for (const table of READ_TABLES)
        expect(probe).toHaveBeenCalledWith(actor, table);
  });
  it.each(["A", "B", "C"])(
    "does not create fixtures if actor %s lacks SELECT despite a reachable backend",
    async (blocked) => {
      const create = vi.fn();
      const probe = vi.fn(async (actor: string) =>
        actor === blocked
          ? { status: 403, data: null, error: { code: "42501" } }
          : { status: 200, data: [], error: null },
      );
      await expect(
        authenticatedReadPreflight(probe).then(create),
      ).rejects.toThrow("Authenticated read preflight");
      expect(create).not.toHaveBeenCalled();
    },
  );
  it.each([
    { status: 401, error: { code: "PGRST301" }, data: null },
    { status: 200, error: null, data: null },
    { status: 200, error: null, data: [{ id: "unexpected row" }] },
    { status: 204, error: null, data: [] },
    { status: 500, error: null, data: [] },
  ])(
    "rejects invalid sessions or unexpected authorized read results",
    async (result) => {
      await expect(
        authenticatedReadPreflight(async () => result),
      ).rejects.toThrow();
    },
  );
  it("propagates network failure and never falls back to an anonymous result", async () => {
    await expect(
      authenticatedReadPreflight(async () => {
        throw Error("offline");
      }),
    ).rejects.toThrow("offline");
  });
});
