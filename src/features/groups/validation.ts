export const positionLabels = {
  goalkeeper: "Goleiro",
  defender: "Defensor",
  midfielder: "Meio-campo",
  forward: "Atacante",
} as const;
export const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  player: "Jogador",
  guest: "Convidado",
};
export function text(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}
export function validName(value: string, max = 100) {
  return value.length >= 1 && value.length <= max;
}
export function validPosition(value: string) {
  return value === "" || Object.hasOwn(positionLabels, value);
}
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/g, "");
}
export function validSlug(value: string) {
  return (
    value.length >= 3 &&
    value.length <= 64 &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
  );
}
export function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export function validRequestId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
export function canManage(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}
export function mutationError(code?: string) {
  if (code === "23505")
    return "Este identificador já está em uso. Escolha outro.";
  if (code === "42501")
    return "Você não tem permissão para esta operação. Atualize a sessão.";
  if (code === "23514")
    return "Confira os campos. Se alterou uma solicitação já enviada, recarregue a página antes de enviar novamente.";
  return "Não foi possível confirmar a operação. Tente novamente sem alterar os dados; a mesma solicitação não será duplicada.";
}
