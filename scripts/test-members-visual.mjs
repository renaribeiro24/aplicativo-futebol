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
    } catch {
      /* waiting for own server */
    }
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
      const viewers = [];
      for (const role of ["owner", "admin", "player"]) {
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
          unexpected.push({ method: req.method(), type: req.resourceType() });
          return route.abort();
        });
        assert.equal(
          (
            await page.goto(base + "/dev/members-preview?role=" + role)
          ).status(),
          200,
        );
        await page
          .getByRole("heading", { name: "Integrantes do grupo", exact: true })
          .waitFor();
        await page
          .getByText(
            "Demonstração isolada com dados fictícios. Gravações desativadas.",
            { exact: true },
          )
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
          .getByRole("heading", { name: /Pessoa sintética — Jogadora/ })
          .waitFor();
        await page.getByLabel("Função", { exact: true }).selectOption("");
        if (role === "player") {
          assert.equal(
            await page
              .getByLabel("Modalidade financeira", { exact: true })
              .count(),
            0,
          );
          assert.equal(
            await page
              .getByRole("heading", { name: "Convite individual", exact: true })
              .count(),
            0,
          );
          assert.equal(
            await page.getByText(/Contato confirmado na entrada:/).count(),
            0,
          );
          assert.equal(
            await page
              .getByRole("button", { name: "Inativar integrante", exact: true })
              .count(),
            0,
          );
          assert.equal(
            await page
              .getByLabel("Situação", { exact: true })
              .locator("option[value=inactive]")
              .count(),
            0,
          );
        } else {
          await page
            .getByLabel("Modalidade financeira", { exact: true })
            .selectOption("casual");
          assert.equal(
            await page
              .getByRole("heading", { name: /Pessoa sintética — Jogadora/ })
              .count(),
            0,
          );
          await page
            .getByLabel("Modalidade financeira", { exact: true })
            .selectOption("");
          await page
            .getByRole("heading", { name: "Convite individual", exact: true })
            .waitFor();
          await page
            .getByRole("button", { name: "Preparar convite", exact: true })
            .waitFor();
          await page
            .getByRole("button", { name: "Revogar convite", exact: true })
            .waitFor();
          await page
            .getByRole("button", { name: "Revogar link", exact: true })
            .waitFor();
          await page
            .getByRole("button", {
              name: "Aprovar como Jogador e Avulso",
              exact: true,
            })
            .waitFor();
          await page
            .getByRole("button", { name: "Recusar", exact: true })
            .waitFor();
          assert.ok(
            (await page
              .getByRole("button", { name: "Agendar modalidade", exact: true })
              .count()) > 0,
          );
          assert.equal(
            await page
              .getByRole("button", {
                name: "Promover a administrador",
                exact: true,
              })
              .count(),
            role === "owner" ? 1 : 0,
          );
          await page
            .getByLabel("Situação", { exact: true })
            .selectOption("inactive");
          await page
            .getByRole("heading", {
              name: "Pessoa sintética — Inativa",
              exact: true,
            })
            .waitFor();
          await page
            .getByText(
              "Para retornar, envie um novo convite individual. O aceite inicia outro período como Jogador e Avulso.",
              { exact: true },
            )
            .waitFor();
          assert.equal(
            await page
              .getByRole("button", { name: "Inativar integrante", exact: true })
              .count(),
            0,
          );
          await page.screenshot({
            path:
              "work/members-ui/" +
              device +
              "-" +
              theme +
              "-" +
              role +
              "-inactive.png",
            fullPage: true,
          });
          await page
            .getByLabel("Situação", { exact: true })
            .selectOption("active");
        }
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
          path: "work/members-ui/" + device + "-" + theme + "-" + role + ".png",
          fullPage: true,
        });
        assert.equal(errors, 0);
        assert.equal(unexpected.length, 0);
        viewers.push({
          role,
          result: "PASS",
          overflow: false,
          errors: 0,
          unexpectedRequests: 0,
          persistence: "disabled_synthetic_demo",
        });
        await context.close();
      }
      results.push({ device, theme, result: "PASS", viewers });
    }
  writeFileSync(
    "work/members-ui/report.json",
    JSON.stringify(
      {
        scope: "isolated_synthetic_ui_not_authenticated_homologation",
        commit: process.env.GITHUB_SHA,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    "MEMBERS_UI " +
      JSON.stringify({
        matricesPassed: results.length,
        roleScenariosPassed: results.reduce((n, r) => n + r.viewers.length, 0),
        failed: 0,
      }),
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
