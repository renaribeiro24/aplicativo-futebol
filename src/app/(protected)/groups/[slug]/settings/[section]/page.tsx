import MembersPage from "../../members/page";
import { readLocationState } from "@/features/groups/location/server";
import { PrimaryLocationForm } from "@/features/groups/location/form";
import { searchConfigured } from "@/features/groups/location/provider";
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
  const context = await loadManagedGroup(slug);
  if (section === "members")
    return (
      <div className="space-y-6">
        <Link
          href={`/groups/${slug}/settings`}
          className="text-sm text-primary underline"
        >
          ← Voltar à administração
        </Link>
        {await MembersPage({ params: Promise.resolve({ slug }) })}
      </div>
    );
  const { db, group, role } = context;
  const location =
    section === "general" || section === "schedule"
      ? await readLocationState(context)
      : null;
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
            <CardDescription>
              Escolha o local principal, pesquise um endereço ou preencha
              manualmente. O fuso do grupo será preservado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {location && (
              <PrimaryLocationForm
                state={location}
                slug={slug}
                searchEnabled={searchConfigured()}
              />
            )}
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
                localização principal será usada nas novas agendas e partidas,
                com substituição manual permitida.
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
          venues={location?.ready ? location.venues : venues.data}
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
