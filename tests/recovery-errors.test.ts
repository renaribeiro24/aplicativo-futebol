import { describe, expect, it } from "vitest";
import {
  recoveryFailure,
  recoveryMessage,
} from "@/features/auth/recovery-errors";

describe("public recovery errors", () => {
  it("does not reflect provider details or arbitrary query data", () => {
    const marker = "private-provider-fixture";
    expect(recoveryFailure(marker)).toBe("unavailable");
    expect(recoveryMessage(marker)).not.toContain(marker);
  });
  it("offers safe browser context guidance without announcing expiry", () => {
    expect(recoveryMessage("context")).toContain("navegador");
    expect(recoveryMessage("context")).not.toContain("expirou");
  });
  it("distinguishes service trouble from a consumed link", () => {
    expect(recoveryMessage("unavailable")).toContain("mais tarde");
    expect(recoveryMessage("expired")).toContain("e-mail mais recente");
  });
});
