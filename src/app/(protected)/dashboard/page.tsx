import type { Metadata } from "next";
import { requireUser } from "@/features/auth/session";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
export const metadata: Metadata = { title: "Visão geral" };
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!getSupabaseConfig()) return null;
  // Every entry point guards itself as well as the shared layout.
  const user = await requireUser();
  const params = await searchParams;
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Visão geral</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Bem-vindo ao seu espaço.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Sessão de {user.email} validada.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Uma base pronta para evoluir</CardTitle>
          <CardDescription>Painel provisório</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            O cadastro de grupos será implementado na próxima etapa. Nenhuma
            consulta de grupos, partidas ou jogadores é feita nesta versão.
          </p>
        </CardContent>
      </Card>
      {params.error && (
        <p role="alert" className="text-destructive">
          Não foi possível encerrar a sessão. Tente novamente.
        </p>
      )}
      <form action={logout}>
        <Button variant="outline">Sair da conta</Button>
      </form>
    </div>
  );
}
