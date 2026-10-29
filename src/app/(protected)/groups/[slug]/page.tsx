import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadGroup } from "@/features/groups/server";
import { addGuest } from "@/features/groups/actions";
import {
  canManage,
  roleLabels,
  positionLabels,
} from "@/features/groups/validation";
import { ActionForm } from "@/components/forms/action-form";
import { TextField, PositionField } from "@/components/forms/fields";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export const metadata = { title: "Meu grupo" };
export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string; page?: string; receipt?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { db, group, role } = await loadGroup(slug);
  const page = Math.min(
    100000,
    Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1),
  );
  const result = await db
    .from("group_members")
    .select("id,role,players(id,name,nickname,preferred_position,user_id)", {
      count: "exact",
    })
    .eq("group_id", group.id)
    .eq("status", "active")
    .order("created_at")
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (result.error)
    throw new Error("Não foi possível carregar os jogadores. Tente novamente.");
  const count = result.count ?? 0;
  return (
    <div className="space-y-8">
      <Link
        href="/dashboard"
        className="text-sm text-primary underline underline-offset-4"
      >
        ← Meus grupos
      </Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{roleLabels[role]}</Badge>
          <span className="text-sm text-muted-foreground">
            {count} integrantes ativos · {group.timezone}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
          {group.name}
        </h1>
        <p className="max-w-2xl whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
          {group.description || "Bem-vindo ao espaço do seu grupo."}
        </p>
      </header>
      {(query.saved === "group" || query.saved === "guest") && (
        <p role="status" className="feedback-success">
          {query.saved === "group"
            ? "Grupo criado. Você é o proprietário ativo."
            : "Jogador convidado cadastrado com sucesso."}
        </p>
      )}
      {canManage(role) && (
        <Link
          href={`/groups/${slug}/settings`}
          className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 py-2 font-semibold text-brand-foreground"
        >
          Administrar grupo
        </Link>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Quem joga com você</CardTitle>
          <CardDescription>
            Identidades esportivas dos integrantes ativos, sem dados privados
            das contas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum jogador nesta página.
            </p>
          ) : (
            <ul className="divide-y">
              {result.data.map((member) => {
                const player = member.players;
                if (!player) return null;
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium [overflow-wrap:anywhere]">
                        {player.name}
                        {player.nickname && (
                          <span className="ml-2 font-normal text-muted-foreground">
                            ({player.nickname})
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {player.preferred_position &&
                        player.preferred_position in positionLabels
                          ? positionLabels[
                              player.preferred_position as keyof typeof positionLabels
                            ]
                          : "Posição não informada"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {player.user_id ? "Conta vinculada" : "Convidado"}
                      </Badge>
                      <Badge variant="secondary">
                        {roleLabels[member.role]}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <nav
            aria-label="Páginas de jogadores"
            className="mt-4 flex justify-between gap-4"
          >
            {page > 1 ? (
              <Link
                className="text-sm text-primary underline"
                href={`/groups/${slug}?page=${page - 1}`}
              >
                Anterior
              </Link>
            ) : (
              <span />
            )}
            {page * 20 < count && (
              <Link
                className="text-sm text-primary underline"
                href={`/groups/${slug}?page=${page + 1}`}
              >
                Próxima
              </Link>
            )}
          </nav>
        </CardContent>
      </Card>
      {canManage(role) && (
        <section aria-labelledby="manage-group">
          <Card>
            <CardHeader>
              <CardTitle id="manage-group">
                Administração · adicionar convidado
              </CardTitle>
              <CardDescription>
                Cadastre um jogador sem conta. Não haverá vínculo automático com
                e-mails ou contas existentes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                key={query.receipt ?? "initial"}
                action={addGuest.bind(null, slug)}
                label="Cadastrar convidado"
                requestId={randomUUID()}
              >
                <TextField name="name" label="Nome do jogador" required />
                <TextField
                  name="nickname"
                  label="Apelido (opcional)"
                  maxLength={60}
                />
                <PositionField />
              </ActionForm>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
