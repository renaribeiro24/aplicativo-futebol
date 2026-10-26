// Uses existing Playwright/Chromium only. Never installs tools or stores sessions.
import assert from "node:assert/strict";
import {
  expectedPrefetchAbort,
  networkFailureSummary,
} from "./stage0032-ui-observations.mjs";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const loadPackage = createRequire(import.meta.url);
let playwright;
try {
  playwright = loadPackage("playwright");
} catch {
  /* optional existing tool */
}
const authenticated = process.argv.includes("--authenticated");
const localPublic = process.argv.includes("--local-public");
const dashboardOnly = process.argv.includes("--dashboard-only");
assert(
  !dashboardOnly || authenticated,
  "--dashboard-only requires --authenticated",
);
const systemBrowser =
  process.env.CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const credentials = [
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_ACCOUNTS_ARE_SYNTHETIC",
];
if (process.argv.includes("--check")) {
  console.log(
    JSON.stringify({
      playwrightAvailable: Boolean(playwright),
      systemBrowserAvailable: Boolean(
        systemBrowser && existsSync(systemBrowser),
      ),
      credentials: Object.fromEntries(
        credentials.map((k) => [k, Boolean(process.env[k])]),
      ),
      noToolInstallation: true,
    }),
  );
  process.exit(0);
}
assert(
  authenticated !== localPublic,
  "Choose exactly one mode: --authenticated or --local-public",
);
const origin = authenticated
  ? "https://www.borafute.com.br"
  : process.env.UI_TEST_ORIGIN || "http://127.0.0.1:3300";
const u = new URL(origin);
assert(
  !u.username && !u.password && !u.search && !u.hash && u.pathname === "/",
  "Origin must have no credentials, path or query",
);
assert(
  authenticated ||
    (u.protocol === "http:" && ["127.0.0.1", "localhost"].includes(u.hostname)),
  "Local public mode requires HTTP loopback",
);
const group = "/groups/audit-0032-a-8467145b-fb16-4cbd-89f5-3cf149b3a830";
const foreign = "/groups/audit-0032-b-8467145b-fb16-4cbd-89f5-3cf149b3a830";
const combinations = [
  { device: "desktop", width: 1440, height: 900, theme: "light" },
  { device: "desktop", width: 1440, height: 900, theme: "dark" },
  { device: "mobile", width: 390, height: 844, theme: "light" },
  { device: "mobile", width: 390, height: 844, theme: "dark" },
];
const run = randomUUID();
const directory = `work/stage0032-ui-${run}`;
mkdirSync(directory, { recursive: true, mode: 0o700 });
const report = {
  run,
  mode: authenticated
    ? dashboardOnly
      ? "authenticated_dashboard_diagnostic"
      : "authenticated_owner_readonly"
    : "local_public_unconfigured",
  origin,
  result: "started",
  checks: [],
  matrix: (dashboardOnly ? combinations.slice(0, 1) : combinations).map(
    (c) => ({ ...c, status: "PENDENTE" }),
  ),
  diagnosticOnly: dashboardOnly,
  privateScreenshots: false,
  limitations: [
    "No guest/profile submission or new fixture creation",
    "Contrast, touch, loading and empty states require manual review",
  ],
};
if (dashboardOnly)
  report.limitations.unshift(
    "Dashboard diagnostic only; not the full private matrix",
  );
function save() {
  writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2), {
    mode: 0o600,
  });
}
function check(label, passed, detail = {}) {
  report.checks.push({ label, passed, ...detail });
  save();
  if (!passed) {
    currentCheck = label;
    throw new Error("UI_CHECK_FAILED");
  }
}
let browser;
let currentCheck = "browser_start";
let activeCombination;
try {
  currentCheck = "tool_precheck";
  if (!playwright) {
    report.result = "BLOQUEADO";
    throw new Error("EXISTING_PLAYWRIGHT_REQUIRED");
  }
  currentCheck = "credential_precheck";
  if (
    authenticated &&
    (!credentials.every((k) => Boolean(process.env[k])) ||
      process.env.TEST_ACCOUNTS_ARE_SYNTHETIC !== "1")
  ) {
    report.result = "BLOQUEADO";
    throw new Error("CREDENTIALS_REQUIRED");
  }
  currentCheck = "browser_start";
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      ...(systemBrowser ? { executablePath: systemBrowser } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  } catch {
    report.result = "BLOQUEADO";
    throw new Error("BROWSER_UNAVAILABLE");
  }
  const context = await browser.newContext({ locale: "pt-BR" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  let errors = { console: 0, page: 0, network: 0, http: 0 };
  let canceledPrefetches = 0;
  let networkFailures = [];
  const requestSteps = new WeakMap();
  page.on("request", (request) => requestSteps.set(request, currentCheck));
  let expected404 = false;
  let currentPath = "/";
  page.on("pageerror", () => errors.page++);
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/Failed to load resource|NEXT_HTTP_ERROR_FALLBACK;404/.test(m.text())
    )
      errors.console++;
  });
  page.on("requestfailed", (request) => {
    if (
      expectedPrefetchAbort(
        request.failure()?.errorText,
        request.headers()["next-router-prefetch"],
      )
    )
      canceledPrefetches++;
    else {
      errors.network++;
      if (networkFailures.length < 20)
        networkFailures.push(
          networkFailureSummary({
            url: request.url(),
            origin,
            reason: request.failure()?.errorText,
            type: request.resourceType(),
            method: request.method(),
            prefetchHeader: request.headers()["next-router-prefetch"],
            navigation: request.isNavigationRequest(),
            startedInPreviousStep:
              requestSteps.has(request) &&
              requestSteps.get(request) !== currentCheck,
          }),
        );
    }
  });
  page.on("response", (r) => {
    if (r.status() < 400) return;
    const path = new URL(r.url()).pathname;
    if (!(r.status() === 404 && expected404 && path === currentPath))
      errors.http++;
  });
  if (authenticated) {
    currentCheck = "login";
    const loginPage = await page.goto(origin + "/login");
    if (
      new URL(page.url()).origin !== origin ||
      [401, 403].includes(loginPage?.status())
    ) {
      report.result = "BLOQUEADO";
      currentCheck = "untrusted_or_protected_login";
      throw new Error("LOGIN_ORIGIN_OR_PROTECTION");
    }
    await page
      .getByRole("heading", { name: "Bom ter você por aqui.", exact: true })
      .waitFor({ state: "visible" });
    for (const c of combinations) {
      await page.setViewportSize({ width: c.width, height: c.height });
      await page.emulateMedia({ colorScheme: c.theme });
      const loginLayout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        heading: document.querySelectorAll("h1").length,
        emailVisible: Boolean(
          document.querySelector("#email")?.getClientRects().length,
        ),
        passwordVisible: Boolean(
          document.querySelector("#password")?.getClientRects().length,
        ),
      }));
      check(
        `login_layout_${c.device}_${c.theme}`,
        !loginLayout.overflow &&
          loginLayout.heading === 1 &&
          loginLayout.emailVisible &&
          loginLayout.passwordVisible,
        { dom: loginLayout },
      );
    }
    await page.locator("#email").fill(process.env.TEST_USER_A_EMAIL);
    await page.locator("#password").fill(process.env.TEST_USER_A_PASSWORD);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/dashboard"),
      page.getByRole("button", { name: "Entrar", exact: true }).click(),
    ]);
    const identity = await context.request.get(origin + "/api/me");
    check("login_session", identity.status() === 200);
  } else {
    currentCheck = "local_unconfigured_guard";
    check(
      currentCheck,
      (await context.request.get(origin + "/api/me")).status() === 503,
    );
  }
  for (const combination of report.matrix) {
    activeCombination = combination;
    await page.setViewportSize({
      width: combination.width,
      height: combination.height,
    });
    await page.emulateMedia({ colorScheme: combination.theme });
    const routes = authenticated
      ? dashboardOnly
        ? ["/dashboard"]
        : [
            "/dashboard",
            group,
            "/profile",
            "/groups/new",
            foreign,
            "/ui-audit-not-found",
          ]
      : [
          "/",
          "/login",
          "/signup",
          "/forgot-password?error=context",
          "/confirm-email",
          "/reset-password",
          "/dashboard",
          "/groups/new",
          "/profile",
          "/ui-audit-not-found",
        ];
    for (const path of routes) {
      const route =
        path === group
          ? "/groups/[own]"
          : path === foreign
            ? "/groups/[foreign]"
            : path;
      currentCheck = `${combination.device}_${combination.theme}_${route}`;
      errors = { console: 0, page: 0, network: 0, http: 0 };
      canceledPrefetches = 0;
      networkFailures = [];
      currentPath = new URL(path, origin).pathname;
      expected404 = path === foreign || path === "/ui-audit-not-found";
      const response = await page.goto(origin + path, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.locator("h1").first().waitFor({ state: "visible" });
      if (expected404)
        await page
          .getByRole("heading", {
            name: "Esta página não foi encontrada.",
            exact: true,
          })
          .waitFor({ state: "visible" });
      if (authenticated && path === foreign) {
        const mainText = await page
          .locator("#main-content")
          .first()
          .innerText();
        check(
          `${currentCheck}_private_text_absent`,
          !mainText.includes("Auditoria 003.2 8467145b") &&
            !mainText.includes("Convidado fictício auditoria 003.2"),
        );
      }
      if (authenticated && path === group) {
        await page
          .getByRole("heading", {
            name: "Auditoria 003.2 8467145b",
            exact: true,
          })
          .waitFor({ state: "visible" });
        check(
          `${currentCheck}_guest_form`,
          await page
            .getByRole("textbox", { name: "Nome do jogador", exact: true })
            .isVisible(),
        );
      }
      if (!authenticated && path === "/login")
        check(
          `${currentCheck}_setup_only`,
          await page
            .getByText("Autenticação em preparação", { exact: true })
            .isVisible(),
        );
      const dom = await page.evaluate(() => {
        const visible = (e) => e.getClientRects().length > 0;
        const controls = [
          ...document.querySelectorAll(
            "input:not([type=hidden]),select,textarea",
          ),
        ].filter(visible);
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          h1: document.querySelectorAll("h1").length,
          main: document.querySelector("#main-content") !== null,
          unlabelled: controls.filter(
            (e) =>
              !e.labels?.length &&
              !e.getAttribute("aria-label") &&
              !e.getAttribute("aria-labelledby"),
          ).length,
          background: getComputedStyle(document.body).backgroundColor,
        };
      });
      await page.keyboard.press("Tab");
      const keyboard = await page.evaluate(
        () =>
          document.activeElement?.matches(
            "a,button,input,select,textarea,[tabindex]",
          ) ?? false,
      );
      check(
        currentCheck,
        Boolean(response) &&
          [200, 404].includes(response.status()) &&
          !dom.overflow &&
          dom.h1 === 1 &&
          dom.main &&
          dom.unlabelled === 0 &&
          keyboard &&
          Object.values(errors).every((n) => n === 0),
        {
          status: response?.status(),
          dom,
          keyboard,
          errors,
          canceledPrefetches,
          networkFailures,
        },
      );
      if (!authenticated && path === "/")
        await page.screenshot({
          path: `${directory}/${combination.device}-${combination.theme}-public.png`,
          fullPage: true,
        });
    }
    if (authenticated && !dashboardOnly) {
      currentCheck = `${combination.device}_${combination.theme}_navigation`;
      await page.goto(origin + "/dashboard");
      await Promise.all([
        page.waitForURL((url) => url.pathname === group),
        page.locator(`a[href="${group}"]`).first().click(),
      ]);
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/profile"),
        page.getByRole("link", { name: "Meu perfil", exact: true }).click(),
      ]);
      check(currentCheck, new URL(page.url()).pathname === "/profile");
    }
    combination.status = "PASS";
    save();
  }
  if (authenticated) {
    currentCheck = "logout";
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/login"),
      page.getByRole("button", { name: "Sair da conta", exact: true }).click(),
    ]);
    check(
      "logout_identity",
      (await context.request.get(origin + "/api/me")).status() === 401,
    );
    currentCheck = "anonymous_private_guards";
    for (const route of dashboardOnly
      ? []
      : ["/dashboard", group, "/profile", "/groups/new"]) {
      await page.goto(origin + route);
      check(
        "anonymous_private_guard",
        new URL(page.url()).pathname === "/login",
      );
    }
  }
  report.result = "PASS";
} catch {
  if (report.result !== "BLOQUEADO") {
    report.result = "FAIL";
    if (activeCombination) activeCombination.status = "FAIL";
  }
  report.failure = { checkpoint: currentCheck, detailsSuppressed: true };
  process.exitCode = report.result === "BLOQUEADO" ? 2 : 1;
} finally {
  if (browser) await browser.close();
  save();
}
console.log(
  JSON.stringify({
    result: report.result,
    mode: report.mode,
    diagnosticOnly: dashboardOnly,
    matrix: report.matrix,
    passed: report.checks.filter((c) => c.passed).length,
    failed: report.checks.filter((c) => !c.passed).length,
    failedChecks: report.checks.filter((c) => !c.passed),
    failure: report.failure,
    report: `${directory}/report.json`,
    noPersistedSessions: true,
  }),
);
