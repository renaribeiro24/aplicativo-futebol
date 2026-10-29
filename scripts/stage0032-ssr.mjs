// Never persist response bodies, headers, cookies, identity IDs or redirect URLs.
function heading(html, value) {
  const escaped = value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
      })[c],
  );
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].some(
    (m) => m[1].trim() === escaped,
  );
}
export async function checkSsr({ origin, sessions, onCheck, fetcher = fetch }) {
  for (const s of sessions) {
    for (const scenario of ["identity", "own_group", "foreign_group"]) {
      const path =
        scenario === "identity"
          ? "/api/me"
          : `/groups/${scenario === "own_group" ? s.ownSlug : s.foreignSlug}`;
      const report = {
        account: s.account,
        scenario,
        route: scenario === "identity" ? "/api/me" : "/groups/[slug]",
        expected:
          scenario === "foreign_group"
            ? "not_found"
            : scenario === "identity"
              ? "200_matching_identity"
              : "200_group_content",
        expectedStatus: scenario === "foreign_group" ? [200, 404] : [200],
        code: null,
        status: null,
        redirect: "none",
        category: "connectivity",
        vercelProtection: false,
        privateDataPresent: false,
        passed: false,
      };
      try {
        const response = await fetcher(origin + path, {
          headers: {
            Cookie: [...s.jar].map(([k, v]) => `${k}=${v}`).join("; "),
          },
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        });
        report.status = response.status;
        const location = response.headers.get("location");
        if (location) {
          try {
            const target = new URL(location, origin);
            report.redirect =
              target.origin !== origin
                ? "external"
                : target.pathname === "/login"
                  ? "login"
                  : "same_origin_other";
            report.vercelProtection =
              ["vercel.com", "vercel.app"].includes(target.hostname) &&
              /\/sso|\/login|\/auth/.test(target.pathname);
          } catch {
            report.redirect = "invalid";
          }
        }
        const body = await response.text();
        report.vercelProtection ||=
          response.headers.has("x-vercel-mitigated") ||
          /Authentication Required|Vercel Authentication|Deployment Protection/.test(
            body,
          );
        const fallback404 =
          /\$RX\("B:\d+","NEXT_HTTP_ERROR_FALLBACK;404"/.test(body) ||
          /<template\b[^>]*\bdata-dgst=["']NEXT_HTTP_ERROR_FALLBACK;404["'][^>]*>/i.test(
            body,
          );
        if (fallback404) report.code = "NEXT_HTTP_ERROR_FALLBACK;404";
        const notFound =
          (heading(body, "Esta página não foi encontrada.") || fallback404) &&
          /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*noindex)[^>]*>/i.test(
            body,
          );
        const ownContent = heading(body, s.ownName);
        report.privateDataPresent =
          scenario === "foreign_group" &&
          s.forbiddenMarkers.some((marker) => body.includes(marker));
        if (report.vercelProtection) report.category = "deployment_protection";
        else if (response.status >= 300 && response.status < 400)
          report.category =
            report.redirect === "login"
              ? "session_rejected"
              : "unexpected_redirect";
        else if (response.status === 401) report.category = "session_rejected";
        else if (response.status === 403) report.category = "access_denied";
        else if (response.status === 503)
          report.category = "configuration_or_unavailable";
        else if (response.status >= 500) report.category = "server_error";
        else if (scenario === "identity") {
          try {
            report.passed =
              response.status === 200 && JSON.parse(body).id === s.userId;
            report.category = report.passed ? "ok" : "identity_mismatch";
          } catch {
            report.category = "invalid_json";
          }
        } else if (scenario === "own_group") {
          report.passed = response.status === 200 && ownContent && !notFound;
          report.category = report.passed ? "ok" : "unexpected_page";
        } else {
          // Next.js can stream the shell before notFound(); HTTP stays 200.
          report.passed =
            [200, 404].includes(response.status) &&
            notFound &&
            !ownContent &&
            !report.privateDataPresent;
          report.category = report.passed
            ? response.status === 200
              ? "streamed_not_found"
              : "not_found"
            : "isolation_or_unexpected_page";
        }
      } catch (error) {
        report.category =
          error?.name === "TimeoutError" || error?.name === "AbortError"
            ? "timeout"
            : "connectivity_or_executor";
      }
      onCheck(report);
      if (!report.passed) return false;
    }
  }
  return true;
}
