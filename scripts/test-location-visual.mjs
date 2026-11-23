import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const modulePath = process.env.LOCATION_PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error("Explicit isolated Playwright module required");
const { chromium } = createRequire(import.meta.url)(modulePath);
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3344"], {
  env: { ...process.env, VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/stage0042-operational" },
  stdio: "ignore",
});
const base = "http://127.0.0.1:3344";
const url = base + "/homologacao/localizacao";
let browser;
const results = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* server starting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Isolated local Next server must respond");
  browser = await chromium.launch({ headless: true });
  mkdirSync("work/location-ui", { recursive: true });
  for (const [device, width] of [["desktop", 1440], ["mobile", 390]]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await context.newPage();
      const unexpected = [];
      let errors = 0;
      let mapRequests = 0;
      page.on("pageerror", () => errors++);
      await page.route("**/*", route => {
        const request = route.request();
        if (request.url().startsWith(base + "/") && request.method() === "GET") return route.continue();
        if (request.url().startsWith("https://www.openstreetmap.org/export/embed.html") && request.method() === "GET") {
          mapRequests++;
          return route.abort();
        }
        unexpected.push({ method: request.method(), type: request.resourceType() });
        return route.abort();
      });
      assert.equal((await page.goto(url)).status(), 200);
      await page.getByRole("heading", { name: "Dados gerais e localização", exact: true }).waitFor();
      for (const key of ["latitude", "longitude"]) {
        const input = page.locator(`input[name="${key}"]`);
        assert.equal(await input.getAttribute("type"), "hidden");
        assert.equal(await input.isVisible(), false);
      }
      await page.getByLabel("Nome do estabelecimento ou campo", { exact: true }).fill("Campo sintético");
      await page.getByLabel("Logradouro", { exact: true }).fill("Rua sintética");
      await page.getByLabel("Cidade", { exact: true }).fill("Cidade sintética");
      await page.locator('select[name="state"]').selectOption("SP");
      await page.getByRole("button", { name: "Validar rascunho — não grava", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Rascunho validado nesta aba. Não gravado no banco." }).waitFor();
      assert.equal(unexpected.length, 0);
      assert.equal(await page.locator("iframe").count(), 0);
      // Test internal metadata without making coordinates a user-facing control.
      await page.locator('input[name="latitude"]').evaluate(input => { input.value = "0"; });
      await page.locator('input[name="longitude"]').evaluate(input => { input.value = "0"; });
      await page.getByRole("button", { name: "Validar rascunho — não grava", exact: true }).click();
      const result = page.getByRole("region", { name: "Resultado da validação" });
      const href = await result.getByRole("link", { name: "Abrir na navegação" }).getAttribute("href");
      assert.equal(new URL(href).searchParams.get("destination"), "0,0");
      await result.getByRole("button", { name: "Visualizar mapa" }).click();
      assert.equal(await page.locator("iframe").count(), 1);
      assert.equal(new URL(await page.locator("iframe").getAttribute("src")).searchParams.get("marker"), "0,0");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: `work/location-ui/${device}-${theme}.png`, fullPage: true });
      await page.reload();
      await page.getByLabel("Nome do estabelecimento ou campo", { exact: true }).waitFor();
      assert.equal(await page.getByLabel("Nome do estabelecimento ou campo", { exact: true }).inputValue(), "");
      assert.equal(unexpected.length, 0);
      assert.equal(errors, 0);
      results.push({ device, theme, coordinateInputsHidden: true, manualAddressAccepted: true, internalMapPreserved: true, mapRequestsIntercepted: mapRequests, unexpectedRequests: 0, errors: 0, result: "PASS" });
      await context.close();
    }
  }
  writeFileSync("work/location-ui/report.json", JSON.stringify({ scope: "isolated_no_supabase_no_geoapify", results }, null, 2));
  console.log(JSON.stringify({ matricesPassed: results.length, failed: 0 }));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
