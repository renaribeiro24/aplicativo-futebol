import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-lg px-5 py-20">
      <p className="text-sm text-muted-foreground">404 · Fora de campo</p>
      <h1 className="mt-3 text-3xl font-semibold">
        Esta página não foi encontrada.
      </h1>
      <p className="mt-4 mb-7 text-muted-foreground">
        Confira o endereço ou volte para a página inicial.
      </p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
