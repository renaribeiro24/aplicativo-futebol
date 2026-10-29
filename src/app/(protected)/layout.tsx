import { getSupabaseConfig } from "@/lib/supabase/config";
import { requireUser } from "@/features/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!getSupabaseConfig())
    return (
      <AppShell>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">
          Seu espaço, em preparação.
        </h1>
        <p className="mb-8 text-muted-foreground">
          A área reservada será liberada após a configuração do acesso.
        </p>
        <SetupNotice />
      </AppShell>
    );
  await requireUser();
  return <AppShell>{children}</AppShell>;
}
