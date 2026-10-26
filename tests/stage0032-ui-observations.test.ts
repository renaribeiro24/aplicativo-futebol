import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TextField } from "../src/components/forms/fields";
import { describe, expect, it } from "vitest";
import { expectedPrefetchAbort } from "../scripts/stage0032-ui-observations.mjs";
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
