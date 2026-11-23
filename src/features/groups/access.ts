/** Permanent active membership is checked separately by the DB lookup. */
export function hasPrivateGroupAccess(
  role: string | null | undefined,
): boolean {
  return role === "owner" || role === "admin" || role === "player";
}
