import Link from "next/link";
import {
  ArrowRight,
  Users,
  ShieldCheck,
  Layers3,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
const principles = [
  {
    icon: Users,
    title: "Cada grupo, seu espaço",
    text: "Uma plataforma pensada para grupos independentes, com organização e identidade próprias.",
  },
  {
    icon: ShieldCheck,
    title: "Permissões por grupo",
    text: "O papel de cada pessoa pertence ao grupo. Participar de um não dá acesso aos demais.",
  },
  {
    icon: Layers3,
    title: "Uma conta, vários times",
    text: "A identidade de acesso é separada da esportiva, incluindo jogadores convidados sem conta.",
  },
];
export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
        <div>
          <Badge variant="outline" className="mb-7 gap-2">
            <span className="size-1.5 rounded-full bg-primary" />
            Em construção · Primeira etapa
          </Badge>
          <h1 className="max-w-xl text-4xl leading-[1.12] font-semibold tracking-tight sm:text-6xl">
            Mais jogo.
            <br />
            <span className="text-muted-foreground">Menos improviso.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            O ponto de partida para organizar o futebol da semana. Uma
            plataforma para conectar pessoas e dar espaço a cada grupo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Acessar meu espaço
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#proposta">Conhecer a proposta</a>
            </Button>
          </div>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            Fundação disponível. Grupos, partidas e convites serão desenvolvidos
            nas próximas etapas.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-3xl border bg-primary p-7 text-primary-foreground sm:p-10">
          <div className="flex items-center justify-between">
            <span className="text-xs tracking-[.18em] uppercase">
              O próximo jogo começa na organização
            </span>
            <CircleDot className="size-6 shrink-0" aria-hidden="true" />
          </div>
          <div
            aria-hidden="true"
            className="relative my-9 aspect-[1.55] rounded-xl border border-current/30"
          >
            <div className="absolute inset-y-0 left-1/2 border-l border-current/30" />
            <div className="absolute top-1/2 left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-current/30" />
            <div className="absolute top-1/4 bottom-1/4 left-0 w-[18%] rounded-r border border-l-0 border-current/30" />
            <div className="absolute top-1/4 right-0 bottom-1/4 w-[18%] rounded-l border border-r-0 border-current/30" />
            <span className="absolute top-[32%] left-[25%] size-3 rounded-full bg-current" />
            <span className="absolute top-[65%] left-[40%] size-3 rounded-full bg-current/50" />
            <span className="absolute top-[38%] right-[24%] size-3 rounded-full bg-current/70" />
            <span className="absolute right-[33%] bottom-[22%] size-3 rounded-full bg-current/40" />
          </div>
          <p className="text-xl font-medium tracking-tight">
            Seu grupo tem história.
            <br />A organização pode acompanhar.
          </p>
          <p className="mt-3 text-sm leading-6 opacity-75">
            Amador ou society. Durante a semana ou no fim dela. Um espaço para
            cada jeito de jogar.
          </p>
        </div>
      </section>
      <section id="proposta" className="border-t py-12 sm:py-16">
        <p className="text-xs font-medium tracking-widest text-primary uppercase">
          Pensado desde a base
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          O coletivo começa com uma boa estrutura.
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {principles.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="shadow-none">
              <CardHeader>
                <Icon className="mb-3 size-6 text-primary" aria-hidden="true" />
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  {text}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
