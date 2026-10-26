import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TextField } from "../src/components/forms/fields";
import { describe, expect, it } from "vitest";
import {
  expectedPrefetchAbort,
  networkFailureSummary,
} from "../scripts/stage0032-ui-observations.mjs";
describe("Next route prefetch cancellation", () => {
  it("recognizes only the explicit canceled speculative request", () => {
    expect(expectedPrefetchAbort("net::ERR_ABORTED", "1")).toBe(true);
  });
  it.each([
    ["net::ERR_ABORTED", undefined],
    ["net::ERR_ABORTED", "0"],
    ["net::ERR_CONNECTION_RESET", "1"],
    [undefined, "1"],
  ])("keeps other network failures visible: %s / %s", (reason, header) => {
    expect(expectedPrefetchAbort(reason, header)).toBe(false);
  });
});

describe("guest field accessible label contract", () => {
  it("associates the guest name input through its wrapping label", () => {
    const html = renderToStaticMarkup(
      createElement(TextField, {
        name: "name",
        label: "Nome do jogador",
        required: true,
      }),
    );
    expect(html).toMatch(
      /<label[^>]*>Nome do jogador<input(?=[^>]*name="name")(?=[^>]*required="")/,
    );
  });
});

describe("sanitized network observations", () => {
  it("retains failure type and lifecycle without URL or query", () => {
    const r = networkFailureSummary({
      url: "https://app.test/dashboard?code=private-code",
      origin: "https://app.test",
      reason: "net::ERR_ABORTED",
      type: "fetch",
      method: "GET",
      startedInPreviousStep: true,
    });
    expect(r).toMatchObject({
      reason: "net::ERR_ABORTED",
      type: "fetch",
      resource: "app_route",
      prefetch: false,
      startedInPreviousStep: true,
    });
    expect(JSON.stringify(r)).not.toMatch(/app.test|dashboard|private-code/);
  });
  it("does not disclose external host, credentials or arbitrary headers", () => {
    const r = networkFailureSummary({
      url: "https://user:private-password@external.test/path?token=private-token",
      origin: "https://app.test",
      reason: "private-error",
      type: "private-type",
      method: "private-method",
      prefetchHeader: "private-header",
    });
    expect(r).toMatchObject({
      reason: "other",
      type: "other",
      method: "other",
      resource: "external",
      prefetch: false,
    });
    expect(JSON.stringify(r)).not.toMatch(/private-|external.test|user/);
  });
  it("recognizes assets and API while keeping normal failures visible", () => {
    expect(
      networkFailureSummary({
        url: "https://app.test/_next/static/a.js?token=secret",
        origin: "https://app.test",
        reason: "net::ERR_CONNECTION_RESET",
      }),
    ).toMatchObject({
      resource: "static_asset",
      reason: "net::ERR_CONNECTION_RESET",
    });
    expect(
      networkFailureSummary({
        url: "https://app.test/api/me",
        origin: "https://app.test",
      }).resource,
    ).toBe("app_api");
    expect(
      networkFailureSummary({ url: "invalid", origin: "https://app.test" })
        .resource,
    ).toBe("unknown");
  });
});
