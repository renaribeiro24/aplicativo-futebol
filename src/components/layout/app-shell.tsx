import { brand } from "@/lib/brand";
import Link from "next/link";
import { LayoutDashboard, ArrowLeft, LockKeyhole } from "lucide-react";
import { Brand } from "./brand";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-t-4 border-t-brand border-b bg-card p-5 md:min-h-screen md:border-r md:border-b-0 md:p-7">
        <Brand />
        <p className="mt-3 text-sm text-muted-foreground">{brand.slogan}</p>
        <p className="mt-8 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Área reservada
        </p>
        <nav
          aria-label="Navegação da área reservada"
          className="mt-4 flex flex-wrap gap-2 md:block md:space-y-2"
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-muted"
          >
            <LayoutDashboard className="size-4" aria-hidden="true" />
            Visão geral
          </Link>
          <Link
            href="/groups/new"
            className="block rounded-lg px-3 py-3 text-sm hover:bg-muted"
          >
            Criar grupo
          </Link>
          <Link
            href="/profile"
            className="block rounded-lg px-3 py-3 text-sm hover:bg-muted"
          >
            Meu perfil
          </Link>
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Voltar ao início
          </Link>
        </nav>
        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="size-3.5" aria-hidden="true" />
          Espaço reservado
        </p>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b bg-card px-5 sm:px-10">
          <p className="min-w-0 text-sm text-muted-foreground">
            {brand.statement}
          </p>
          <form action={logout}>
            <Button variant="outline" size="sm">
              Sair da conta
            </Button>
          </form>
        </header>
        <main id="main-content" className="mx-auto max-w-5xl p-5 py-10 sm:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
