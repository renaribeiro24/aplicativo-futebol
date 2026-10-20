import { PublicHeader } from "@/components/layout/public-header";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main id="main-content">{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 border-t px-5 py-7 text-xs text-muted-foreground sm:px-8">
        <span>Em Campo · Futebol em grupo</span>
        <span>Uma base para o que vem a seguir.</span>
      </footer>
    </>
  );
}
