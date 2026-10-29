import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/features/auth/session";
import { GroupForm } from "@/features/groups/group-form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export const metadata = { title: "Criar grupo" };
export default async function NewGroup() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard"
        className="text-sm text-primary underline underline-offset-4"
      >
        ← Meus grupos
      </Link>
      <h1 className="text-3xl font-semibold">Seu grupo começa aqui.</h1>
      <Card>
        <CardHeader>
          <CardTitle>Um espaço para o seu futebol</CardTitle>
          <CardDescription>
            Você será o proprietário do grupo. Cada grupo tem seus próprios
            jogadores e permissões.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GroupForm requestId={randomUUID()} />
        </CardContent>
      </Card>
    </div>
  );
}
