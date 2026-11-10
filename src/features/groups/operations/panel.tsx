import "server-only";
import { notFound } from "next/navigation";
import { canManage } from "../validation";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ScheduleForm,
  DeactivateForm,
  PricingForm,
  BillingForm,
  EndPeriodForm,
} from "./forms";
import {
  pageNumber,
  periodState,
  todayInTimezone,
  moneyLabel,
  weekdayLabels,
  type Member,
  type Venue,
} from "./validation";
export type SettingsQuery = {
  schedulePage?: string;
  pricePage?: string;
  billingPage?: string;
  membersPage?: string;
};
export function SettingsPager({
  slug,
  query,
  field,
  page,
  count,
  size = 10,
}: {
  slug: string;
  query: SettingsQuery;
  field: keyof SettingsQuery;
  page: number;
  count: number;
  size?: number;
}) {
  const href = (n: number) => {
    const p = new URLSearchParams();
    for (const k of [
      "schedulePage",
      "pricePage",
      "billingPage",
      "membersPage",
    ] as const)
      p.set(k, String(k === field ? n : pageNumber(query[k])));
    return `/groups/${slug}/settings?${p.toString()}#${field === "pricePage" ? "pricing" : field === "billingPage" ? "billing" : field === "membersPage" ? "members" : "schedule"}`;
  };
  return (
    <nav
      aria-label={`Paginação ${field}`}
      className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm"
    >
      <span>
        Página {page} · {count} registro(s)
      </span>
      <div className="flex gap-4">
        {page > 1 && (
          <Link href={href(page - 1)} className="text-primary underline">
            Anterior
          </Link>
        )}
        {page * size < count && (
          <Link href={href(page + 1)} className="text-primary underline">
            Próxima
          </Link>
        )}
      </div>
    </nav>
  );
}
function Period({ from, until }: { from: string; until: string | null }) {
  return (
    <p className="text-sm text-muted-foreground">
      Vigência: {from} até {until ?? "sem fim definido"}
      {until ? " (fim exclusivo)" : ""}
    </p>
  );
}
const stateLabels = {
  future: "Futura",
  current: "Vigente",
  ended: "Histórico encerrado",
};
export async function OperationsPanel({
  slug,
  groupId,
  role,
  timezone,
  db,
  members,
  venues,
  query,
}: {
  slug: string;
  groupId: string;
  role: string;
  timezone: string;
  db: SupabaseClient<Database>;
  members: Member[];
  venues: Venue[];
  query: SettingsQuery;
}) {
  if (!canManage(role)) notFound();
  const today = todayInTimezone(timezone),
    sp = pageNumber(query.schedulePage),
    pp = pageNumber(query.pricePage),
    bp = pageNumber(query.billingPage);
  const [schedules, prices, terms] = await Promise.all([
    db
      .from("group_schedules")
      .select("*", { count: "exact" })
      .eq("group_id", groupId)
      .order("starts_on")
      .order("id")
      .range((sp - 1) * 10, sp * 10 - 1),
    db
      .from("group_pricing_policies")
      .select("*", { count: "exact" })
      .eq("group_id", groupId)
      .order("effective_from", { ascending: false })
      .order("id")
      .range((pp - 1) * 10, pp * 10 - 1),
    db
      .from("member_billing_terms")
      .select("*,member:group_members(players(name,nickname))", {
        count: "exact",
      })
      .eq("group_id", groupId)
      .order("effective_from", { ascending: false })
      .order("id")
      .range((bp - 1) * 10, bp * 10 - 1),
  ]);
  if (schedules.error || prices.error || terms.error)
    throw new Error(
      "Não foi possível carregar as configurações operacionais. Tente novamente.",
    );
  return (
    <>
      <Card>
        <CardHeader>
          <h2 id="schedule" className="text-xl font-semibold">
            Agenda recorrente
          </h2>
          <CardDescription>
            Proprietário e administradores podem cadastrar, editar e desativar
            agendas. Fuso: {timezone}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <details className="rounded-lg border p-4">
            <summary className="min-h-11 cursor-pointer font-semibold text-primary">
              Cadastrar nova agenda
            </summary>
            <div className="mt-5">
              <ScheduleForm slug={slug} venues={venues} />
            </div>
          </details>
          {schedules.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma agenda nesta página.
            </p>
          ) : (
            schedules.data.map((row) => (
              <article key={row.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold">
                    {weekdayLabels[row.weekday]} ·{" "}
                    {row.starts_at_local.slice(0, 8)}
                  </h3>
                  <Badge variant={row.is_active ? "default" : "secondary"}>
                    {row.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {row.duration_minutes} minutos ·{" "}
                  {row.recurrence_type === "biweekly" ? "Quinzenal" : "Semanal"}{" "}
                  ·{" "}
                  {venues.find((v) => v.id === row.venue_id)?.name ??
                    "Sem local ativo definido"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Referência: {row.starts_on} · até{" "}
                  {row.ends_on ?? "sem data final"}
                </p>
                <details>
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold text-primary">
                    Editar agenda
                  </summary>
                  <div className="mt-4">
                    <ScheduleForm slug={slug} value={row} venues={venues} />
                  </div>
                </details>
                {row.is_active && (
                  <details>
                    <summary className="min-h-11 cursor-pointer text-sm text-muted-foreground">
                      Desativar
                    </summary>
                    <div className="mt-3">
                      <DeactivateForm slug={slug} id={row.id} />
                    </div>
                  </details>
                )}
              </article>
            ))
          )}
          <SettingsPager
            slug={slug}
            query={query}
            field="schedulePage"
            page={sp}
            count={schedules.count ?? 0}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 id="pricing" className="text-xl font-semibold">
            Mensalidades e valores avulsos
          </h2>
          <CardDescription>
            {role === "owner"
              ? "Somente você, como proprietário, pode alterar preços e vencimentos."
              : "Consulta do histórico. Somente o proprietário pode alterar preços, vencimentos e vigências."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Versões iniciadas são preservadas. Trocar uma política vigente por
            outra em uma única operação depende de fluxo transacional ainda não
            disponível; não faça fechamento e cadastro esperando uma troca
            atômica.
          </p>
          {role === "owner" && (
            <details className="rounded-lg border p-4">
              <summary className="min-h-11 cursor-pointer font-semibold text-primary">
                Cadastrar política em intervalo livre
              </summary>
              <div className="mt-5">
                <PricingForm slug={slug} today={today} />
              </div>
            </details>
          )}
          {prices.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma política de preços nesta página. Nenhum valor foi
              atribuído automaticamente.
            </p>
          ) : (
            prices.data.map((row) => {
              const state = periodState(row, today);
              return (
                <article
                  key={row.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <Badge variant="secondary">{stateLabels[state]}</Badge>
                  <p className="font-medium">
                    Mensalidade: {moneyLabel(row.monthly_amount_cents)} ·
                    Avulso/convidado: {moneyLabel(row.casual_amount_cents)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vencimento:{" "}
                    {row.due_day ? `dia ${row.due_day}` : "não se aplica"}
                  </p>
                  <Period
                    from={row.effective_from}
                    until={row.effective_until}
                  />
                  {role === "owner" && state === "future" && (
                    <details>
                      <summary className="min-h-11 cursor-pointer text-sm font-semibold text-primary">
                        Editar versão futura
                      </summary>
                      <div className="mt-4">
                        <PricingForm slug={slug} value={row} today={today} />
                      </div>
                    </details>
                  )}
                  {role === "owner" && state !== "ended" && (
                    <details>
                      <summary className="min-h-11 cursor-pointer text-sm text-muted-foreground">
                        Encerrar sem substituição automática
                      </summary>
                      <div className="mt-4">
                        <EndPeriodForm
                          slug={slug}
                          id={row.id}
                          kind="pricing"
                          today={today}
                        />
                      </div>
                    </details>
                  )}
                </article>
              );
            })
          )}
          <SettingsPager
            slug={slug}
            query={query}
            field="pricePage"
            page={pp}
            count={prices.count ?? 0}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 id="billing" className="text-xl font-semibold">
            Classificação financeira
          </h2>
          <CardDescription>
            Proprietário e administradores podem classificar integrantes ativos.
            Convidados são exclusivamente avulsos; não há outras categorias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Somente versões futuras podem mudar de classificação. Vigências
            atuais são históricas; encerramento não gera substituição automática
            nem cobrança.
          </p>
          <details className="rounded-lg border p-4">
            <summary className="min-h-11 cursor-pointer font-semibold text-primary">
              Cadastrar classificação em intervalo livre
            </summary>
            <div className="mt-5">
              {members.some((m) => m.players) ? (
                <BillingForm slug={slug} members={members} today={today} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum integrante elegível nesta página. Confira a paginação
                  de integrantes.
                </p>
              )}
            </div>
          </details>
          {terms.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma classificação financeira nesta página.
            </p>
          ) : (
            terms.data.map((row) => {
              const state = periodState(row, today);
              return (
                <article
                  key={row.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap gap-3">
                    <h3 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                      {row.member?.players?.name ?? "Integrante indisponível"}
                    </h3>
                    <Badge variant="secondary">
                      {row.billing_type === "monthly" ? "Mensalista" : "Avulso"}
                    </Badge>
                    <Badge variant="outline">{stateLabels[state]}</Badge>
                  </div>
                  <Period
                    from={row.effective_from}
                    until={row.effective_until}
                  />
                  {state === "future" && (
                    <details>
                      <summary className="min-h-11 cursor-pointer text-sm font-semibold text-primary">
                        Editar classificação futura
                      </summary>
                      <div className="mt-4">
                        <BillingForm
                          slug={slug}
                          value={row}
                          members={members}
                          today={today}
                        />
                      </div>
                    </details>
                  )}
                  {state !== "ended" && (
                    <details>
                      <summary className="min-h-11 cursor-pointer text-sm text-muted-foreground">
                        Encerrar sem substituição automática
                      </summary>
                      <div className="mt-4">
                        <EndPeriodForm
                          slug={slug}
                          id={row.id}
                          kind="billing"
                          today={today}
                        />
                      </div>
                    </details>
                  )}
                </article>
              );
            })
          )}
          <SettingsPager
            slug={slug}
            query={query}
            field="billingPage"
            page={bp}
            count={terms.count ?? 0}
          />
        </CardContent>
      </Card>
    </>
  );
}
