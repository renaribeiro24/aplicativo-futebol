import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brand } from "@/components/layout/brand";
import { LocationDemo } from "@/features/groups/location/demo";
import { locationDemoAvailable } from "@/features/groups/location/preview";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Homologação de localização",
  robots: { index: false, follow: false },
};
export default function LocationDemoPage() {
  if (!locationDemoAvailable()) notFound();
  return (
    <main
      id="main-content"
      className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-8"
    >
      <Brand linked={false} className="w-52" />
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">
          Preview de homologação
        </p>
        <h1 className="font-display text-3xl font-semibold">
          Dados gerais e localização
        </h1>
        <p className="text-muted-foreground">
          Avalie os campos, a validação, a responsividade e a visualização do
          endereço sem utilizar o banco do BoraFute.
        </p>
      </header>
      <LocationDemo />
    </main>
  );
}
