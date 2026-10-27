import { brand } from "@/lib/brand";
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
        <span>
          {brand.name} · {brand.slogan}
        </span>
        <span>{brand.statement}</span>
      </footer>
    </>
  );
}
