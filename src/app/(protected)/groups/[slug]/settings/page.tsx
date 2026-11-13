import Link from "next/link";
import {
  Users,
  CalendarDays,
  Settings2,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { loadManagedGroup } from "@/features/groups/server";
import { roleLabels } from "@/features/groups/validation";
import { settingsSections } from "@/features/groups/operations/sections";
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export const metadata = { title: "Administrar grupo" };
export default async function GroupSettings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { db, group, role } = await loadManagedGroup(slug);
  const [members, schedules, policies] = await Promise.all([
    db
      .from("group_members")
      .select("id", { head: true, count: "exact" })
      .eq("group_id", group.id)
      .eq("status", "active"),
    db
      .from("group_schedules")
      .select("id", { head: true, count: "exact" })
      .eq("group_id", group.id)
      .eq("is_active", true),
    db
      .from("group_pricing_policies")
      .select("id", { head: true, count: "exact" })
      .eq("group_id", group.id),
  ]);
  const count = (r: { error: unknown; count: number | null }, label: string) =>
    r.error || r.count === null
      ? "Indicador indisponível"
      : `${r.count} ${label}`;
  const indicators = [
    group.timezone,
    count(members, "integrante(s) ativo(s)"),
    count(schedules, "agenda(s) ativa(s)"),
    count(policies, "política(s) no histórico"),
  ];
  const icons = [Settings2, Users, CalendarDays, Wallet];
  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8">
      <Link href={`/groups/${slug}`} className="text-sm text-primary underline">
        ← Voltar ao grupo
      </Link>
      <header className="brand-surface space-y-3 rounded-xl border border-border bg-background p-5 sm:p-6">
        <Badge>{roleLabels[role]}</Badge>
        <h1 className="text-3xl font-semibold [overflow-wrap:anywhere]">
          Administrar {group.name}
        </h1>
        <p className="text-muted-foreground">
          Tudo para organizar sua turma, dentro e fora de campo.
        </p>
      </header>
      <nav
        aria-label="Áreas da administração"
        className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
      >
        {settingsSections.map((section, i) => {
          const Icon = icons[i];
          return (
            <Link
              key={section.path}
              href={`/groups/${slug}/settings/${section.path}`}
              className="group min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <Card className="h-full transition-colors group-hover:border-primary/60">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <Icon aria-hidden="true" className="size-7 text-primary" />
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-5 text-muted-foreground"
                    />
                  </div>
                  <h2 className="mt-3 text-xl font-semibold">
                    {section.title}
                  </h2>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <p className="text-sm font-medium text-primary [overflow-wrap:anywhere]">
                    {indicators[i]}
                  </p>
                  {section.path === "finance" && role !== "owner" && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Consulta. Alterações exclusivas do proprietário.
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
