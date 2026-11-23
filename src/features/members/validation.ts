export type MemberRole = "owner" | "admin" | "player" | "guest";
export function isManager(role: string) {
  return role === "owner" || role === "admin";
}
export function mayManageMember(actor: MemberRole, target: MemberRole) {
  return actor === "owner"
    ? target !== "owner"
    : actor === "admin" && target === "player";
}
export function mayPromote(
  actor: MemberRole,
  target: MemberRole,
  status: string,
) {
  return actor === "owner" && target === "player" && status === "active";
}
export function tokenValid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
export function uuidValid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function normalizeRecipient(value: string) {
  return value.trim().toLowerCase();
}
export function emailValid(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function invitationUrl(
  origin: string,
  kind: "individual" | "shared",
  token: string,
) {
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" && url.hostname !== "localhost")
  )
    throw Error("Invalid origin");
  if (!tokenValid(token)) throw Error("Invalid token");
  return (
    origin +
    "/admissoes/" +
    (kind === "individual" ? "individual" : "solicitacao") +
    "#token=" +
    token
  );
}
export function memberError(code?: string) {
  if (code === "P4290")
    return "Já houve uma tentativa automática para este destinatário nas últimas 24 horas. Compartilhe manualmente ou aguarde.";
  if (code === "P4092")
    return "O retorno ao grupo exige um novo convite individual.";
  if (code === "P4091") return "Esta conta já está ativa no grupo.";
  if (code === "P4090" || code === "23505")
    return "A operação já foi processada ou foi alterada. Atualize a página.";
  if (code === "23514" || code === "23P01" || code === "22023")
    return "Confira os dados, as datas e as vigências informadas.";
  if (code === "42501")
    return "Ação não autorizada ou convite indisponível. Confira a conta e solicite um novo link, se necessário.";
  if (code === "PGRST202" || code === "42883")
    return "Gestão de integrantes em preparação neste ambiente. Nenhuma alteração foi salva.";
  return "Não foi possível confirmar a operação. Atualize a página antes de tentar novamente.";
}
