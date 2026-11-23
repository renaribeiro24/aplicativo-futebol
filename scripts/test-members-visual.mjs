import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
if (!process.env.LOCATION_PLAYWRIGHT_MODULE)
  throw Error("Explicit isolated browser required");
const { chromium } = createRequire(import.meta.url)(
  process.env.LOCATION_PLAYWRIGHT_MODULE,
);
const base = "http://127.0.0.1:3345";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3345",
  ],
  { env: { ...process.env, MEMBERS_UI_DEMO: "1" }, stdio: "ignore" },
);
let browser;
const results = [];
try {
  let ready = false;
  for (let n = 0; n < 120; n++) {
    try {
      if ((await fetch(base + "/dev/members-preview")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, "Isolated member UI must respond");
  browser = await chromium.launch({ headless: true });
  mkdirSync("work/members-ui", { recursive: true });
  for (const [device, width] of [
    ["desktop", 1440],
    ["mobile", 390],
  ])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      let errors = 0;
      const unexpected = [];
      page.on("pageerror", () => errors++);
      await page.route("**/*", (route) => {
        const req = route.request();
        if (req.url().startsWith(base + "/") && req.method() === "GET")
          return route.continue();
        unexpected.push({ type: req.resourceType(), method: req.method() });
        return route.abort();
      });
      assert.equal(
        (await page.goto(base + "/dev/members-preview")).status(),
        200,
      );
      await page
        .getByRole("heading", { name: "Integrantes do grupo", exact: true })
        .waitFor();
      await page.getByLabel("Função", { exact: true }).selectOption("player");
      assert.equal(
        await page
          .getByRole("heading", {
            name: "Pessoa sintética — Proprietária",
            exact: true,
          })
          .count(),
        0,
      );
      await page
        .getByRole("heading", {
          name: "Pessoa sintética — Jogadora",
          exact: true,
        })
        .waitFor();
      await page.getByLabel("Função", { exact: true }).selectOption("");
      await page
        .getByLabel("Modalidade financeira", { exact: true })
        .selectOption("casual");
      assert.equal(
        await page
          .getByRole("heading", {
            name: "Pessoa sintética — Jogadora",
            exact: true,
          })
          .count(),
        0,
      );
      await page
        .getByLabel("Modalidade financeira", { exact: true })
        .selectOption("");
      await page
        .getByLabel("Situação", { exact: true })
        .selectOption("inactive");
      await page
        .getByText("Nenhum integrante encontrado com estes filtros.", {
          exact: true,
        })
        .waitFor();
      await page.getByLabel("Situação", { exact: true }).selectOption("active");
      assert.equal(
        await page.locator("button[type=submit]:enabled").count(),
        0,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement !== document.body),
        true,
      );
      await page.screenshot({
        path: "work/members-ui/" + device + "-" + theme + ".png",
        fullPage: true,
      });
      assert.equal(errors, 0);
      assert.equal(unexpected.length, 0);
      results.push({
        device,
        theme,
        result: "PASS",
        overflow: false,
        unexpectedRequests: 0,
        errors: 0,
        persistence: "disabled_synthetic_demo",
      });
      await context.close();
    }
  writeFileSync(
    "work/members-ui/report.json",
    JSON.stringify(
      {
        scope: "isolated_synthetic_ui_not_authenticated_homologation",
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    "MEMBERS_UI " + JSON.stringify({ passed: results.length, failed: 0 }),
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
