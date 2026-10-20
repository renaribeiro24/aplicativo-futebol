import Link from "next/link";
import { LayoutDashboard, ArrowLeft, LockKeyhole } from "lucide-react";
import { Brand } from "./brand";
import { Badge } from "@/components/ui/badge";
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b bg-card p-5 md:min-h-screen md:border-r md:border-b-0 md:p-7">
        <Brand />
        <p className="mt-8 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Área reservada
        </p>
        <nav
          aria-label="Navegação da área reservada"
          className="mt-4 space-y-2"
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg bg-accent px-3 py-3 text-sm font-medium text-accent-foreground"
          >
            <LayoutDashboard className="size-4" aria-hidden="true" />
            Visão geral
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
      <div>
        <header className="flex min-h-20 items-center justify-between gap-3 border-b bg-card px-5 sm:px-10">
          <p className="text-sm text-muted-foreground">Seu espaço de futebol</p>
          <Badge variant="outline">Fundação técnica</Badge>
        </header>
        <main id="main-content" className="mx-auto max-w-5xl p-5 py-10 sm:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
