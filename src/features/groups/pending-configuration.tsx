import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";

function PendingSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={id} className="text-xl font-semibold">
            {title}
          </h2>
          <Badge variant="secondary">Em preparação</Badge>
        </div>
        <CardDescription id={`${id}-notice`}>
          {description} Nenhuma alteração pode ser salva nesta seção.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset
          disabled
          aria-labelledby={id}
          aria-describedby={`${id}-notice`}
          className="grid min-w-0 gap-5 sm:grid-cols-2"
        >
          {children}
          <Button type="button" disabled className="sm:col-span-2">
            Disponível em breve
          </Button>
        </fieldset>
      </CardContent>
    </Card>
  );
}
function DraftField({
  label,
  type = "text",
}: {
  label: string;
  type?: string;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      {label}
      <Input type={type} />
    </label>
  );
}
export function PendingConfiguration({ owner }: { owner: boolean }) {
  return (
    <>
      <PendingSection
        id="schedule"
        title="Agenda semanal"
        description="Configure os encontros após a liberação das agendas recorrentes."
      >
        <label className="grid gap-2 text-sm font-medium">
          Dia da semana
          <select className="form-control" defaultValue="">
            <option value="">Selecione um dia</option>
            {[
              "Domingo",
              "Segunda-feira",
              "Terça-feira",
              "Quarta-feira",
              "Quinta-feira",
              "Sexta-feira",
              "Sábado",
            ].map((day) => (
              <option key={day}>{day}</option>
            ))}
          </select>
        </label>
        <DraftField label="Horário local" type="time" />
        <DraftField label="Duração em minutos" type="number" />
        <label className="grid gap-2 text-sm font-medium">
          Recorrência
          <select className="form-control" defaultValue="">
            <option value="">Selecione a recorrência</option>
            <option>Semanal</option>
            <option>Quinzenal</option>
          </select>
        </label>
        <DraftField label="Primeiro encontro" type="date" />
        <DraftField label="Último encontro (opcional)" type="date" />
        <DraftField label="Local do encontro" />
      </PendingSection>
      <PendingSection
        id="pricing"
        title="Mensalidades e valores avulsos"
        description={
          owner
            ? "A configuração de preços será exclusiva do proprietário após a liberação financeira."
            : "Somente o proprietário poderá configurar preços, vencimentos e vigências."
        }
      >
        <DraftField label="Mensalidade (R$)" type="number" />
        <DraftField label="Avulso e convidado (R$)" type="number" />
        <DraftField label="Dia de vencimento" type="number" />
        <DraftField label="Início da vigência" type="date" />
      </PendingSection>
      <PendingSection
        id="billing"
        title="Classificação dos integrantes"
        description="Proprietário e administradores poderão organizar mensalistas e avulsos após a liberação financeira."
      >
        <DraftField label="Integrante" />
        <label className="grid gap-2 text-sm font-medium">
          Classificação
          <select className="form-control" defaultValue="">
            <option value="">Selecione a classificação</option>
            <option>Mensalista</option>
            <option>Avulso</option>
          </select>
        </label>
      </PendingSection>
      <PendingSection
        id="participation"
        title="Regras de participação"
        description="A edição de regras e os fluxos de presença ainda não estão disponíveis."
      >
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">
          Regras do grupo
          <textarea className="form-control min-h-24" />
        </label>
      </PendingSection>
    </>
  );
}
