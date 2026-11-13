import Link from "next/link";
import { loadManagedGroup } from "@/features/groups/server";
import { updateGroupDetails } from "@/features/groups/actions";
import { roleLabels } from "@/features/groups/validation";
import {
  OperationsPanel,
  SettingsPager,
  type SettingsQuery,
} from "@/features/groups/operations/panel";
import { pageNumber } from "@/features/groups/operations/validation";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { notFound, redirect } from "next/navigation";
import { settingsSections } from "@/features/groups/operations/sections";
export const metadata = { title: "Configurações do grupo" };
export default async function SettingsSection({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; section: string }>;
  searchParams?: Promise<SettingsQuery>;
}) {
  const { slug, section } = await params;
  if (section === "venues") redirect(`/groups/${slug}/settings/general`);
  const definition = settingsSections.find((s) => s.path === section);
  if (!definition) notFound();
  const { db, group, role } = await loadManagedGroup(slug);
  const query = await (searchParams ?? Promise.resolve({} as SettingsQuery));
  const memberPage = pageNumber(query.membersPage);
  const [members, venues] = await Promise.all([
    section === "members"
      ? db
          .from("group_members")
          .select("id,player_id,role,players(name,nickname)", {
            count: "exact",
          })
          .eq("group_id", group.id)
          .eq("status", "active")
          .order("created_at")
          .order("id")
          .range((memberPage - 1) * 20, memberPage * 20 - 1)
      : Promise.resolve({ data: [], error: null, count: 0 }),
    section === "general" || section === "schedule"
      ? db
          .from("venues")
          .select("id,name,address")
          .eq("group_id", group.id)
          .is("deleted_at", null)
          .order("name")
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (members.error || venues.error)
    throw new Error("Não foi possível carregar a administração do grupo.");
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-8">
      <Link
        href={`/groups/${slug}/settings`}
        className="text-sm text-primary underline"
      >
        ← Voltar à administração
      </Link>
      <header className="brand-surface space-y-3 rounded-xl border border-border bg-background p-5 sm:p-6">
        <Badge>{roleLabels[role]}</Badge>
        <h1 className="text-3xl font-semibold">{definition.title}</h1>
        <p className="text-muted-foreground [overflow-wrap:anywhere]">
          {group.name} · {definition.description}
        </p>
      </header>
      {section === "general" && (
        <Card>
          <CardHeader>
            <h2 id="details" className="text-xl font-semibold">
              Identificação do grupo
            </h2>
            <CardDescription>
              Nome e descrição aparecem para os integrantes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={updateGroupDetails.bind(null, slug)}
              label="Salvar identificação"
            >
              <TextField
                name="name"
                label="Nome do grupo"
                value={group.name}
                required
              />
              <label className="grid gap-2 text-sm font-medium">
                Descrição
                <textarea
                  name="description"
                  defaultValue={group.description ?? ""}
                  maxLength={1000}
                  className="form-control min-h-28"
                />
              </label>
            </ActionForm>
          </CardContent>
        </Card>
      )}
      {section === "general" && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Local do futebol</h2>
            <CardDescription id="primary-venue-notice">
              A definição do local principal e o endereço detalhado estão em
              preparação. Estes campos ainda não podem ser salvos. Nenhum local
              existente será escolhido ou alterado automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <fieldset
              disabled
              aria-describedby="primary-venue-notice"
              className="grid min-w-0 gap-5 sm:grid-cols-2"
            >
              <legend className="sr-only">Local principal em preparação</legend>
              <TextField
                name="venue_name"
                label="Nome do estabelecimento ou campo"
                required
                maxLength={120}
              />
              <TextField
                name="postal_code"
                label="CEP"
                required
                maxLength={9}
              />
              <TextField name="street" label="Logradouro" required />
              <TextField name="street_number" label="Número" required />
              <TextField name="complement" label="Complemento (opcional)" />
              <TextField name="neighborhood" label="Bairro" required />
              <TextField name="city" label="Cidade" required />
              <TextField
                name="state"
                label="Estado (UF)"
                required
                maxLength={2}
              />
            </fieldset>
            <div className="space-y-3">
              <h3 className="font-semibold">Locais existentes preservados</h3>
              {venues.data.length ? (
                <ul className="space-y-3">
                  {venues.data.map((venue) => (
                    <li key={venue.id} className="[overflow-wrap:anywhere]">
                      <span className="font-medium">{venue.name}</span>
                      {venue.address && (
                        <p className="text-sm text-muted-foreground">
                          {venue.address}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum local ativo cadastrado.
                </p>
              )}
              {venues.data.length === 1000 && (
                <p className="text-sm text-muted-foreground">
                  Exibindo os primeiros 1.000 locais ativos.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Locais anteriores e vínculos das agendas são preservados. A
                definição automática de local para novas agendas aguarda
                configuração do local principal.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {section === "members" && (
        <Card>
          <CardHeader>
            <h2 id="members" className="text-xl font-semibold">
              Funções no grupo
            </h2>
            <CardDescription>
              A função define as permissões: owner, admin, player ou guest. Ela
              é independente de mensalista ou avulso, na classificação
              financeira abaixo. Esta tela não altera funções nem transfere a
              propriedade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.data.length ? (
              <ul className="divide-y">
                {members.data.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {member.players?.name ?? "Identidade indisponível"}
                    </span>
                    <Badge variant="secondary">
                      Função: {roleLabels[member.role]} ({member.role})
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum integrante ativo encontrado.
              </p>
            )}
            <Link
              href={`/groups/${slug}`}
              className="mt-4 inline-block text-sm text-primary underline"
            >
              Ver lista paginada e cadastrar convidado
            </Link>
            <SettingsPager
              slug={slug}
              query={query}
              field="membersPage"
              page={memberPage}
              count={members.count ?? 0}
              size={20}
            />
          </CardContent>
        </Card>
      )}
      {(section === "schedule" ||
        section === "finance" ||
        section === "members") && (
        <OperationsPanel
          slug={slug}
          groupId={group.id}
          timezone={group.timezone}
          role={role}
          db={db}
          members={members.data}
          venues={venues.data}
          query={query}
          section={
            section === "schedule"
              ? "schedule"
              : section === "finance"
                ? "pricing"
                : "billing"
          }
        />
      )}
    </div>
  );
}
