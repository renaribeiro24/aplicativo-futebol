import { describe, expect, it } from "vitest";
import { checkSsr, type SsrReport } from "../scripts/stage0032-ssr.mjs";
const notFound =
  '<meta name="robots" content="noindex"/><h1>Esta página não foi encontrada.</h1>';
const group = "<h1>Auditoria &amp; teste</h1>";
const session = {
  account: "A",
  jar: new Map([["sb-test", "synthetic-cookie"]]),
  userId: "synthetic-user",
  ownSlug: "own",
  foreignSlug: "foreign",
  ownName: "Auditoria & teste",
};
async function run(response: Response | Error, stage = "identity") {
  const reports: SsrReport[] = [];
  const calls: RequestInit[] = [];
  const passed = await checkSsr({
    origin: "https://www.borafute.com.br",
    sessions: [session],
    onCheck: (r) => reports.push(r),
    fetcher: async (url, init) => {
      calls.push(init!);
      const scenario = String(url).endsWith("/api/me")
        ? "identity"
        : String(url).endsWith("/own")
          ? "own_group"
          : "foreign_group";
      if (scenario === stage) {
        if (response instanceof Error) throw response;
        return response;
      }
      return new Response(
        scenario === "identity"
          ? JSON.stringify({ id: session.userId })
          : scenario === "own_group"
            ? group
            : notFound,
        { status: scenario === "foreign_group" ? 404 : 200 },
      );
    },
  });
  return { passed, reports, calls };
}
describe("sanitized SSR observations", () => {
  it.each([200, 404])(
    "recognizes actual not-found UI with HTTP %s",
    async (status) => {
      const r = await run(new Response(notFound, { status }), "foreign_group");
      expect(r.passed).toBe(true);
      expect(r.reports).toHaveLength(3);
      expect(r.reports[2].category).toBe(
        status === 200 ? "streamed_not_found" : "not_found",
      );
      expect(r.calls.every((c) => c.redirect === "manual")).toBe(true);
      expect(r.calls[0].headers).toEqual({
        Cookie: "sb-test=synthetic-cookie",
      });
    },
  );
  it.each([200, 404])(
    "does not accept arbitrary HTTP %s as an isolation success",
    async (status) => {
      expect(
        (
          await run(
            new Response("<h1>Private content</h1>", { status }),
            "foreign_group",
          )
        ).passed,
      ).toBe(false);
    },
  );
  it("rejects own-group content even alongside not-found markers", async () => {
    expect(
      (await run(new Response(notFound + group), "foreign_group")).passed,
    ).toBe(false);
  });
  it("rejects streamed errors and setup pages as own-group success", async () => {
    expect((await run(new Response("<h1>Erro</h1>"), "own_group")).passed).toBe(
      false,
    );
  });
  it.each([
    [401, "session_rejected"],
    [403, "access_denied"],
    [500, "server_error"],
    [503, "configuration_or_unavailable"],
  ])("classifies HTTP %s", async (status, category) => {
    const r = await run(
      new Response("sensitive body", { status: Number(status) }),
    );
    expect(r.passed).toBe(false);
    expect(r.reports[0].category).toBe(category);
    expect(JSON.stringify(r.reports)).not.toContain("sensitive body");
  });
  it("detects login redirect without logging the location query", async () => {
    const r = await run(
      new Response(null, {
        status: 307,
        headers: { location: "/login?code=private-code" },
      }),
    );
    expect(r.reports[0]).toMatchObject({
      redirect: "login",
      category: "session_rejected",
      status: 307,
    });
    expect(JSON.stringify(r.reports)).not.toContain("private-code");
  });
  it("detects Vercel protection without logging tokens or headers", async () => {
    const r = await run(
      new Response("Authentication Required", {
        status: 401,
        headers: { "set-cookie": "private-cookie" },
      }),
    );
    expect(r.reports[0]).toMatchObject({
      category: "deployment_protection",
      vercelProtection: true,
    });
    expect(JSON.stringify(r.reports)).not.toMatch(
      /private-cookie|synthetic-cookie|synthetic-user/,
    );
  });
  it("rejects mismatching identity, malformed JSON and HTML success pages", async () => {
    expect(
      (await run(new Response('{"id":"someone-else"}'))).reports[0].category,
    ).toBe("identity_mismatch");
    expect(
      (await run(new Response("<html>login</html>"))).reports[0].category,
    ).toBe("invalid_json");
  });
  it("suppresses network errors including embedded credentials", async () => {
    const r = await run(new Error("Bearer sensitive-token"));
    expect(r.reports[0].category).toBe("connectivity_or_executor");
    expect(JSON.stringify(r.reports)).not.toContain("sensitive-token");
  });
  it("categorizes timeouts", async () => {
    const r = await run(new DOMException("private-url", "TimeoutError"));
    expect(r.reports[0].category).toBe("timeout");
  });
});

describe("streamed not-found error boundary", () => {
  it("recognizes the Next/React 404 boundary plus noindex", async () => {
    const body =
      '<meta name="robots" content="noindex"/><script>$RX("B:0","NEXT_HTTP_ERROR_FALLBACK;404")</script>';
    const r = await run(new Response(body), "foreign_group");
    expect(r.passed).toBe(true);
    expect(r.reports[2].code).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("does not trust a bare digest, preloaded not-found component or noindex alone", async () => {
    for (const body of [
      "NEXT_HTTP_ERROR_FALLBACK;404",
      '<meta name="robots" content="noindex"/>',
      '<script>Esta página não foi encontrada.</script><meta name="robots" content="noindex"/>',
    ]) {
      expect((await run(new Response(body), "foreign_group")).passed).toBe(
        false,
      );
    }
  });
});
