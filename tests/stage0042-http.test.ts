import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  configuration,
  assertBranch,
  assertConfiguration,
  assertIdentities,
  denied,
  verifyDenied,
  validateManifest,
  membershipSeed,
  PROJECT_URL,
  type Env,
  type Actor,
  type Manifest,
} from "../scripts/stage0042-http-guards.mjs";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const env: Env = {
  NEXT_PUBLIC_SUPABASE_URL: PROJECT_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  TEST_USER_A_EMAIL: "a@example.invalid",
  TEST_USER_A_PASSWORD: "not-real-a",
  TEST_USER_B_EMAIL: "b@example.invalid",
  TEST_USER_B_PASSWORD: "not-real-b",
  TEST_USER_C_EMAIL: "c@example.invalid",
  TEST_USER_C_PASSWORD: "not-real-c",
  TEST_ACCOUNTS_ARE_SYNTHETIC: "1",
  TEST_ALLOW_CREATE_AUDIT_FIXTURES: "1",
};
const actors: Actor[] = [1, 2, 3].map((n) => ({
  user: { id: id(n), email_confirmed_at: "2026-11-03" },
  player: id(n + 10),
  token: `synthetic-unit-only-${n}`,
}));
const run = id(100);
const manifest: Manifest = {
  version: 1,
  run,
  project: PROJECT_URL,
  groups: [
    { id: id(20), slug: `audit-0042-a-${run}` },
    { id: id(21), slug: `audit-0042-b-${run}` },
  ],
  identities: actors.map((a) => ({ user: a.user.id, player: a.player })),
};
describe("004.2 runner safety — unit fixtures, not real JWT evidence", () => {
  it("reports presence and declarations without exposing values", () => {
    const c = configuration(env);
    expect(JSON.stringify(c)).not.toContain("not-real");
    expect(Object.values(c.present).every(Boolean)).toBe(true);
    expect(() => assertConfiguration(env)).not.toThrow();
  });
  it.each([
    "TEST_USER_C_PASSWORD",
    "TEST_ACCOUNTS_ARE_SYNTHETIC",
    "TEST_ALLOW_CREATE_AUDIT_FIXTURES",
  ])("fails closed when %s is missing", (key) => {
    expect(() => assertConfiguration({ ...env, [key]: undefined })).toThrow();
  });
  it.each(["0", "true", "yes"])(
    "does not accept an ambiguous creation flag %s",
    (flag) => {
      expect(() =>
        assertConfiguration({ ...env, TEST_ALLOW_CREATE_AUDIT_FIXTURES: flag }),
      ).toThrow();
    },
  );
  it.each([
    "https://other.supabase.co",
    "https://hpbvtqvbtyioqjyelrpb.supabase.co.evil.invalid",
    "http://hpbvtqvbtyioqjyelrpb.supabase.co",
  ])("restricts target project %s", (url) => {
    expect(() =>
      assertConfiguration({ ...env, NEXT_PUBLIC_SUPABASE_URL: url }),
    ).toThrow();
  });
  it("rejects a service or secret key", () => {
    expect(() =>
      assertConfiguration({
        ...env,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_fake",
      }),
    ).toThrow();
  });
  it("requires three distinct confirmed identities", () => {
    expect(() => assertIdentities(actors)).not.toThrow();
    expect(() =>
      assertIdentities([...actors.slice(0, 2), actors[0]]),
    ).toThrow();
    expect(() =>
      assertIdentities(
        actors.map((a, i) => (i === 2 ? { ...a, user: { id: a.user.id } } : a)),
      ),
    ).toThrow();
  });
  it("rejects anonymous Auth users and repeated sessions", () => {
    expect(() =>
      assertIdentities(
        actors.map((a, i) =>
          i === 2 ? { ...a, user: { ...a.user, is_anonymous: true } } : a,
        ),
      ),
    ).toThrow();
    expect(() =>
      assertIdentities(actors.map((a) => ({ ...a, token: "same" }))),
    ).toThrow();
  });
  it.each(["23514", "23503", "23P01", "PGRST205", "PGRST301"])(
    "does not confuse %s with denied authorization",
    (code) => {
      expect(denied({ status: 400, error: { code } })).toBe(false);
    },
  );
  it("accepts only real forbidden responses or explicit zero-row update/delete", () => {
    expect(denied({ status: 403, error: { code: "42501" } })).toBe(true);
    expect(denied({ status: 200, data: [] })).toBe(false);
    expect(denied({ status: 200, data: [] }, ["42501"], true)).toBe(true);
    expect(denied({ status: 0, error: { code: "42501" } })).toBe(false);
    expect(
      denied({ status: 200, data: [{ id: id(1) }] }, ["42501"], true),
    ).toBe(false);
  });
  it("allows a constraint code only when explicitly requested", () => {
    expect(denied({ status: 409, error: { code: "23P01" } }, ["23P01"])).toBe(
      true,
    );
  });
  it("verifies unchanged rows after a refused write", async () => {
    await expect(
      verifyDenied(
        async () => ({ status: 403, error: { code: "42501" } }),
        [{ id: id(1) }],
        async () => [{ id: id(1) }],
      ),
    ).resolves.toMatchObject({ unchanged: true });
  });
  it("fails on persisted changes even if the response says forbidden", async () => {
    await expect(
      verifyDenied(
        async () => ({ status: 403, error: { code: "42501" } }),
        [{ id: id(1) }],
        async () => [{ id: id(2) }],
      ),
    ).rejects.toThrow("Integrity");
  });
  it("reads state even if an unexpected write returned success", async () => {
    const after = vi.fn(async () => []);
    await expect(
      verifyDenied(
        async () => ({ status: 201, data: [{ id: id(1) }] }),
        [],
        after,
      ),
    ).rejects.toThrow("not denied");
    expect(after).toHaveBeenCalledOnce();
  });
  it("does not certify integrity when readback fails", async () => {
    await expect(
      verifyDenied(
        async () => ({ status: 403, error: { code: "42501" } }),
        [],
        async () => {
          throw Error("no network");
        },
      ),
    ).rejects.toThrow("no network");
  });
  it("binds manifests to the run, synthetic slugs and exact identities", () => {
    expect(() => validateManifest(manifest, run, actors)).not.toThrow();
    expect(() =>
      validateManifest({ ...manifest, project: "elsewhere" }, run),
    ).toThrow();
    expect(() =>
      validateManifest(
        {
          ...manifest,
          groups: [
            { ...manifest.groups[0], slug: "real-group" },
            manifest.groups[1],
          ],
        },
        run,
      ),
    ).toThrow();
    expect(() =>
      validateManifest(manifest, run, [actors[1], actors[0], actors[2]]),
    ).toThrow();
  });
  it("emits only a guarded INSERT for C, never update/delete/grants or identity claims", () => {
    const sql = membershipSeed(manifest);
    expect(sql).toContain("INSERT INTO public.group_members");
    expect(sql).toContain("Unexpected group A roster");
    expect(sql).toContain("Unexpected group B roster");
    expect(sql).toContain("Wrong technical C");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).not.toMatch(
      /\b(?:ALTER|GRANT|DELETE|set_config|service_role)\b/i,
    );
    expect(sql).not.toMatch(/UPDATE public\./i);
    expect(sql).not.toContain("not-real");
  });
  it("rejects injection attempts in identifiers before SQL generation", () => {
    expect(() =>
      membershipSeed({
        ...manifest,
        identities: [
          ...manifest.identities.slice(0, 2),
          { ...manifest.identities[2], player: "bad'); drop table x;--" },
        ],
      }),
    ).toThrow();
  });
});

describe("004.2 CLI fail-closed checks (no network or real credentials)", () => {
  const binary = "scripts/test-stage0042-http.mjs";
  it("--check emits no credential values", () => {
    const r = spawnSync(process.execPath, [binary, "--check"], {
      env: { ...process.env, ...env },
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("not-real");
    expect(r.stdout).not.toContain("example.invalid");
    expect(JSON.parse(r.stdout).configuration.syntheticDeclaration).toBe(true);
  });
  it("refuses --prepare before creating a manifest when synthetic attestation is absent", () => {
    const manifests = () =>
      readdirSync("work")
        .filter((name) => /^stage0042-http-[0-9a-f-]{36}\.json$/.test(name))
        .sort();
    const before = manifests();
    const r = spawnSync(process.execPath, [binary, "--prepare"], {
      env: { ...process.env, ...env, TEST_ACCOUNTS_ARE_SYNTHETIC: "0" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({
      phase: "preflight",
      passed: 0,
      manifest: null,
    });
    expect(manifests()).toEqual(before);
    expect(r.stdout).not.toContain("not-real");
  });
});

describe("explicit audit branch allowlist", () => {
  it.each(["develop", "test/stage0042-http"])(
    "accepts the authorized branch %s",
    (branch) => {
      expect(() => assertBranch(branch)).not.toThrow();
    },
  );
  it.each(["main", "test/other", "test/stage0042-http-other", ""])(
    "rejects branch %s",
    (branch) => {
      expect(() => assertBranch(branch)).toThrow();
    },
  );
});
