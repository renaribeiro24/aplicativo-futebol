import type { Database } from "@/types/database.types";
export type Schedule = Database["public"]["Tables"]["group_schedules"]["Row"];
export type Pricing =
  Database["public"]["Tables"]["group_pricing_policies"]["Row"];
export type Billing =
  Database["public"]["Tables"]["member_billing_terms"]["Row"];
export type Venue = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name"
>;
export type Member = {
  player_id: string;
  role: string;
  players: { name: string; nickname: string | null } | null;
};
export const weekdayLabels = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
export class InputError extends Error {}
export function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InputError(message);
}
export function identifier(value: string) {
  requireValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    ),
    "Identificador inválido. Atualize a página.",
  );
  return value;
}
export function date(value: string) {
  requireValue(
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number(value.slice(0, 4)) > 0 &&
      Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
      new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value,
    "Informe uma data válida.",
  );
  return value;
}
export function integer(value: string, min: number, max = 2147483647) {
  requireValue(/^\d+$/.test(value), "Informe um número inteiro válido.");
  const n = Number(value);
  requireValue(
    Number.isSafeInteger(n) && n >= min && n <= max,
    `Informe um número entre ${min} e ${max}.`,
  );
  return n;
}
export function cents(value: string) {
  requireValue(
    /^(?:0|[1-9]\d*)(?:[,.]\d{1,2})?$/.test(value),
    "Informe o valor com até duas casas decimais, sem separador de milhar.",
  );
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  requireValue(
    Number.isSafeInteger(amount) && amount >= 0 && amount <= 2147483647,
    "Valor fora do limite permitido.",
  );
  return amount;
}
export function moneyInput(value: number | null) {
  return value === null
    ? ""
    : `${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
}
export function moneyLabel(value: number | null) {
  return value === null
    ? "Desabilitada"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value / 100);
}
function checked(form: FormData, key: string) {
  const value = form.get(key);
  requireValue(value === null || value === "on", "Configuração inválida.");
  return value === "on";
}
export function todayInTimezone(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export function periodState(
  row: { effective_from: string; effective_until: string | null },
  today: string,
) {
  return row.effective_until && row.effective_until <= today
    ? "ended"
    : row.effective_from > today
      ? "future"
      : "current";
}
export function parsePeriod(form: FormData, today: string) {
  const from = date(field(form, "effective_from")),
    until = field(form, "effective_until");
  requireValue(from >= today, "Não é permitido cadastrar vigência retroativa.");
  if (until)
    requireValue(
      date(until) > from,
      "O fim exclusivo deve ser posterior ao início.",
    );
  return { effective_from: from, effective_until: until || null };
}
export function parseSchedule(form: FormData) {
  const weekday = integer(field(form, "weekday"), 0, 6),
    starts_on = date(field(form, "starts_on")),
    end = field(form, "ends_on"),
    time = field(form, "starts_at_local"),
    recurrence = field(form, "recurrence_type"),
    venue = field(form, "venue_id");
  requireValue(
    /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time),
    "Informe um horário válido.",
  );
  requireValue(
    recurrence === "weekly" || recurrence === "biweekly",
    "Selecione recorrência semanal ou quinzenal.",
  );
  requireValue(
    new Date(starts_on + "T12:00:00Z").getUTCDay() === weekday,
    "A primeira ocorrência deve cair no dia da semana escolhido.",
  );
  if (end)
    requireValue(
      date(end) >= starts_on,
      "A última ocorrência não pode anteceder a primeira.",
    );
  return {
    weekday,
    starts_at_local: time,
    duration_minutes: integer(field(form, "duration_minutes"), 1),
    recurrence_type: recurrence,
    interval_weeks: recurrence === "weekly" ? 1 : 2,
    starts_on,
    ends_on: end || null,
    venue_id: venue ? identifier(venue) : null,
    is_active: checked(form, "is_active"),
  };
}
export function parsePricing(form: FormData, today: string) {
  const monthly = checked(form, "monthly_enabled"),
    casual = checked(form, "casual_enabled");
  return {
    ...parsePeriod(form, today),
    monthly_enabled: monthly,
    monthly_amount_cents: monthly ? cents(field(form, "monthly_amount")) : null,
    casual_enabled: casual,
    casual_amount_cents: casual ? cents(field(form, "casual_amount")) : null,
    due_day: monthly ? integer(field(form, "due_day"), 1, 31) : null,
  };
}
export function parseBilling(form: FormData, today: string) {
  const type = field(form, "billing_type");
  requireValue(
    type === "monthly" || type === "casual",
    "Selecione mensalista ou avulso.",
  );
  return { ...parsePeriod(form, today), billing_type: type };
}
export function parseEnd(form: FormData, today: string, from: string) {
  const until = date(field(form, "effective_until"));
  requireValue(
    until > today && until > from,
    "O encerramento deve ser futuro e posterior ao início.",
  );
  return until;
}
export function pageNumber(value: unknown) {
  return typeof value === "string" && /^\d+$/.test(value)
    ? Math.min(100000, Math.max(1, Number(value)))
    : 1;
}
export function errorMessage(error: unknown) {
  if (error instanceof InputError) return error.message;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : null;
  if (code === "23P01")
    return "Já existe uma vigência nesse período. Escolha um intervalo livre; a configuração anterior foi preservada.";
  if (code === "42501")
    return "Operação não permitida. Versões iniciadas não podem ser reescritas; confira seu papel e atualize a página.";
  if (code === "23503")
    return "O local ou integrante não está disponível neste grupo.";
  if (code === "23505")
    return "Já existe um registro com esse identificador ou nome neste grupo.";
  if (code === "23514")
    return "Confira datas, valores e classificação. Convidados só podem ser avulsos.";
  return "Não foi possível confirmar a gravação. Recarregue e confira a lista antes de tentar novamente, para evitar duplicação.";
}
