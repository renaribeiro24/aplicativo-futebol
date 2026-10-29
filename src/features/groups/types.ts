// Domain vocabulary, aligned with migration CHECKs. Not a substitute for generated Database types.
export const groupRoles = ["owner", "admin", "player", "guest"] as const;
export type GroupRole = (typeof groupRoles)[number];
export type MembershipStatus = "active" | "invited" | "suspended" | "left";
