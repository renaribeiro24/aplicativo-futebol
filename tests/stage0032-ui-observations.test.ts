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
