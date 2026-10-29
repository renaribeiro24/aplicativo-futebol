import Link from "next/link";
import { Users, Plus, UserRound } from "lucide-react";
import { loadIdentity } from "@/features/identity/server";
import { canManage, roleLabels } from "@/features/groups/validation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupabaseConfig } from "@/lib/supabase/config";
export const metadata = { title: "Meu dashboard" };
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  if (!getSupabaseConfig()) return null;
  const { db, profile, player } = await loadIdentity();
  const params = await searchParams;
  const result = await db
    .from("group_members")
    .select("role,groups(id,name,slug,description)")
    .eq("player_id", player.id)
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .limit(100);
  if (result.error)
    throw new Error("Não foi possível carregar seus grupos. Tente novamente.");
  const groups = result.data.flatMap((m) =>
    m.groups ? [{ ...m.groups, role: m.role }] : [],
  );
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            Seu futebol, organizado
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">
            Olá, {profile.display_name}.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Escolha seu grupo e entre em campo.
          </p>
        </div>
        <Button asChild>
          <Link href="/groups/new">
            <Plus aria-hidden="true" />
            Criar grupo
          </Link>
        </Button>
      </div>
      {params.error && (
        <p role="alert" className="feedback-error">
          Não foi possível sair. Tente novamente.
        </p>
      )}
      {params.notice === "password" && (
        <p role="status" className="feedback-success">
          Senha atualizada com sucesso.
        </p>
      )}
      <section aria-labelledby="my-groups" className="space-y-4">
        <h2 id="my-groups" className="text-xl font-semibold">
          Meus grupos
        </h2>
        {groups.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 py-8">
              <Users className="size-9 text-primary" aria-hidden="true" />
              <h3 className="text-lg font-semibold">
                O próximo jogo começa com um grupo.
              </h3>
              <p className="text-sm text-muted-foreground">
                Você ainda não possui vínculos ativos. Crie um grupo para
                organizar seus jogadores.
              </p>
              <Button asChild variant="outline">
                <Link href="/groups/new">Criar primeiro grupo</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.id}>
                <CardHeader>
                  <Badge variant="secondary">{roleLabels[group.role]}</Badge>
                  <CardTitle className="mt-3 [overflow-wrap:anywhere]">
                    <Link
                      href={`/groups/${group.slug}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {group.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {group.description || "Um grupo para viver o futebol."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="outline">
                      <Link href={`/groups/${group.slug}`}>Acessar grupo</Link>
                    </Button>
                    {canManage(group.role) && (
                      <Button asChild>
                        <Link href={`/groups/${group.slug}/settings`}>
                          Administrar
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {groups.length === 100 && (
          <p className="text-sm text-muted-foreground">
            Exibindo os 100 vínculos mais recentes.
          </p>
        )}
      </section>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
          <div>
            <h2 className="font-semibold">Sua identidade em campo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nome esportivo e posição compartilhados com seus grupos.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/profile">
              <UserRound aria-hidden="true" />
              Meu perfil
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
