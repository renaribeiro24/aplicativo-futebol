import Link from "next/link";
import { loadManagedGroup } from "@/features/groups/server";
import { updateGroupDetails } from "@/features/groups/actions";
import { roleLabels } from "@/features/groups/validation";
import {
  OperationsPanel,
  SettingsPager,
  type SettingsQuery,
} from "@/features/groups/operations/panel";
import { VenueForm } from "@/features/groups/operations/forms";
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

import { notFound } from "next/navigation";
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
    section === "venues" || section === "schedule"
      ? db
          .from("venues")
          .select("id,name")
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
              Dados gerais
            </h2>
            <CardDescription>
              Nome e descrição aparecem para os integrantes. O fuso indica o
              horário local do grupo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={updateGroupDetails.bind(null, slug)}
              label="Salvar dados do grupo"
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
              <TextField
                name="timezone"
                label="Fuso horário"
                value={group.timezone}
                required
                maxLength={100}
              />
              <p className="text-sm text-muted-foreground">
                Use um fuso IANA, como America/Sao_Paulo. O endereço do grupo
                não será alterado.
              </p>
            </ActionForm>
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
      {section === "venues" && (
        <Card>
          <CardHeader>
            <h2 id="venues" className="text-xl font-semibold">
              Locais de futebol
            </h2>
            <CardDescription>
              Locais ativos deste grupo, disponíveis nas agendas. Cadastre um
              local antes de vinculá-lo a uma agenda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {venues.data.length ? (
              <ul className="space-y-2">
                {venues.data.map((venue) => (
                  <li key={venue.id} className="[overflow-wrap:anywhere]">
                    {venue.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum local cadastrado neste grupo.
              </p>
            )}
            <details className="mt-5 rounded-lg border p-4">
              <summary className="min-h-11 cursor-pointer font-semibold text-primary">
                Cadastrar local
              </summary>
              <div className="mt-4">
                <VenueForm slug={slug} />
              </div>
            </details>
            {venues.data.length === 1000 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Exibindo os primeiros 1.000 locais ativos.
              </p>
            )}
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
