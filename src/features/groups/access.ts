/** Permanent active membership is checked separately by the DB lookup. */
export function hasPrivateGroupAccess(
  role: string | null | undefined,
): role is "owner" | "admin" | "player" {
  return role === "owner" || role === "admin" || role === "player";
}
