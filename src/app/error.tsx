"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="mx-auto max-w-lg px-5 py-20">
      <p className="text-sm text-muted-foreground">Não foi possível carregar</p>
      <h1 className="mt-3 text-3xl font-semibold">Vamos tentar de novo?</h1>
      <p role="alert" className="mt-4 text-muted-foreground">
        Ocorreu um erro ao abrir esta página. Tente novamente em instantes.
      </p>
      <div className="mt-7 flex gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <Button asChild variant="outline">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}
