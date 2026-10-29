import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <main
      id="main-content"
      role="status"
      className="mx-auto max-w-6xl space-y-6 px-5 py-20"
    >
      <span className="sr-only">Carregando conteúdo…</span>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-14 w-full max-w-lg" />
      <Skeleton className="h-48 w-full" />
    </main>
  );
}
