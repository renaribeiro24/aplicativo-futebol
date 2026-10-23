import { describe, expect, it } from "vitest";
import { describeAuthFailure } from "../scripts/stage0032-auth-diagnostics.mjs";

describe("stage0032 authentication diagnostics", () => {
  it("keeps provider error details while redacting credentials and tokens", () => {
    const detail = describeAuthFailure(
      {
        name: "AuthApiError",
        code: "invalid_credentials",
        status: 400,
        message:
          "Login failed for tester@example.com; password=p@ssword and access_token=eyJhbGci.abc.xyz",
      },
      ["tester@example.com", "p@ssword"],
    );

    expect(detail).toEqual({
      name: "AuthApiError",
      code: "invalid_credentials",
      status: 400,
      message:
        "Login failed for <redacted>; password=<redacted> and access_token=<redacted>",
    });
    expect(JSON.stringify(detail)).not.toMatch(
      /tester@example\.com|p@ssword|eyJhbGci/,
    );
  });

  it("preserves safe rate-limit and connectivity diagnostics", () => {
    expect(
      describeAuthFailure({
        name: "AuthApiError",
        code: "over_request_rate_limit",
        status: 429,
        message: "Too many requests",
      }),
    ).toEqual({
      name: "AuthApiError",
      code: "over_request_rate_limit",
      status: 429,
      message: "Too many requests",
    });

    expect(
      describeAuthFailure({
        name: "TypeError",
        message: "fetch failed",
      }),
    ).toEqual({ name: "TypeError", message: "fetch failed" });
  });
});
