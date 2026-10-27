import Link from "next/link";
import { Brand } from "./brand";
import { Button } from "@/components/ui/button";
export function PublicHeader() {
  return (
    <header className="brand-surface border-t-4 border-t-brand border-b bg-pitch">
      <div className="mx-auto flex min-h-20 max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Brand tone="dark" className="sm:w-48" />
        <nav
          aria-label="Navegação principal"
          className="flex items-center gap-3 sm:gap-6"
        >
          <Link
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
            href="/#proposta"
          >
            A proposta
          </Link>
          <Button asChild size="sm" variant="ghost">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Criar conta</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
