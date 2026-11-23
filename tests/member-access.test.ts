import { describe, expect, it } from "vitest";
import { hasPrivateGroupAccess } from "@/features/groups/access";
describe("permanent group access", () => {
  it.each(["owner", "admin", "player"])("permits %s after active membership verification", role => {
    expect(hasPrivateGroupAccess(role)).toBe(true);
  });
  it.each(["guest", "OWNER", "administrator", "", "unknown", null, undefined])("rejects %s", role => {
    expect(hasPrivateGroupAccess(role)).toBe(false);
  });
});
