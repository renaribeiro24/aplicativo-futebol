import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brand } from "@/lib/brand";
export const metadata: Metadata = {
  title: {
    default: `${brand.name} | ${brand.slogan}`,
    template: `%s | ${brand.name}`,
  },
  description: brand.statement,
  applicationName: brand.name,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brand.theme.light },
    { media: "(prefers-color-scheme: dark)", color: brand.theme.dark },
  ],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <a
          href="#main-content"
          className="sr-only z-50 rounded bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
