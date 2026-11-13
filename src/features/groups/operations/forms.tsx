"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { TextField } from "@/components/forms/fields";
import {
  saveSchedule,
  deactivateSchedule,
  savePricing,
  saveBilling,
  endPricing,
  endBilling,
  createVenue,
} from "./actions";
import {
  weekdayLabels,
  moneyInput,
  type Schedule,
  type Pricing,
  type Billing,
  type Venue,
  type Member,
} from "./validation";
function DateField({
  name,
  label,
  value,
  required = false,
  min,
}: {
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      {label}
      <Input
        type="date"
        name={name}
        defaultValue={value ?? ""}
        required={required}
        min={min}
      />
    </label>
  );
}
function PeriodFields({
  value,
  today,
}: {
  value?: { effective_from: string; effective_until: string | null };
  today: string;
}) {
  return (
    <div className="grid min-w-0 gap-5 sm:grid-cols-2">
      <DateField
        name="effective_from"
        label="Início da vigência"
        value={value?.effective_from}
        required
        min={today}
      />
      <DateField
        name="effective_until"
        label="Fim exclusivo (opcional)"
        value={value?.effective_until}
        min={today}
      />
      <p className="text-sm font-normal text-muted-foreground sm:col-span-2">
        O início é inclusivo e o fim é exclusivo. Se começar hoje, o conteúdo
        fica imutável imediatamente. Períodos não podem se sobrepor; fim vazio
        mantém a regra sem data final.
      </p>
    </div>
  );
}
export function ScheduleForm({
  slug,
  value,
  venues,
}: {
  slug: string;
  value?: Schedule;
  venues: Venue[];
}) {
  return (
    <ActionForm
      action={saveSchedule.bind(null, slug, value?.id ?? null)}
      label={value ? "Salvar agenda" : "Cadastrar agenda"}
    >
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Dia da semana
          <select
            name="weekday"
            defaultValue={value?.weekday ?? ""}
            required
            className="form-control"
          >
            <option value="" disabled>
              Selecione o dia
            </option>
            {weekdayLabels.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Horário local
          <Input
            name="starts_at_local"
            type="time"
            step="1"
            defaultValue={value?.starts_at_local?.slice(0, 8)}
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Duração em minutos
          <Input
            name="duration_minutes"
            type="number"
            min="1"
            max="2147483647"
            step="1"
            defaultValue={value?.duration_minutes}
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Recorrência
          <select
            name="recurrence_type"
            defaultValue={value?.recurrence_type ?? "weekly"}
            className="form-control"
          >
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quinzenal</option>
          </select>
        </label>
        <DateField
          name="starts_on"
          label="Primeira ocorrência / referência"
          value={value?.starts_on}
          required
        />
        <DateField
          name="ends_on"
          label="Última ocorrência inclusiva (opcional)"
          value={value?.ends_on}
        />
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">
          Local
          <select
            name="venue_id"
            defaultValue={value?.venue_id ?? ""}
            className="form-control"
          >
            <option value="">Sem local definido</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={value?.is_active ?? true}
            className="size-5 accent-primary"
          />
          Agenda ativa
        </label>
      </div>
      {!value && (
        <p className="text-sm text-muted-foreground">
          A seleção automática do local principal está em preparação; escolha o
          local desta agenda.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        A data inicial deve cair no dia escolhido e serve de referência para a
        recorrência quinzenal. Horários usam o fuso do grupo. Esta configuração
        não gera partidas.
      </p>
    </ActionForm>
  );
}
export function DeactivateForm({ slug, id }: { slug: string; id: string }) {
  return (
    <ActionForm
      action={deactivateSchedule.bind(null, slug, id)}
      label="Desativar agenda"
    >
      <p className="text-sm text-muted-foreground">
        A agenda será preservada, apenas marcada como inativa.
      </p>
    </ActionForm>
  );
}
export function VenueForm({ slug }: { slug: string }) {
  return (
    <ActionForm action={createVenue.bind(null, slug)} label="Cadastrar local">
      <TextField name="name" label="Nome do local" required maxLength={120} />
      <TextField name="address" label="Endereço (opcional)" maxLength={500} />
    </ActionForm>
  );
}
export function PricingForm({
  slug,
  value,
  today,
}: {
  slug: string;
  value?: Pricing;
  today: string;
}) {
  const [monthly, setMonthly] = useState(value?.monthly_enabled ?? false),
    [casual, setCasual] = useState(value?.casual_enabled ?? false);
  return (
    <ActionForm
      action={savePricing.bind(null, slug, value?.id ?? null)}
      label={value ? "Salvar política futura" : "Cadastrar política de preços"}
    >
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="monthly_enabled"
            checked={monthly}
            onChange={(e) => setMonthly(e.target.checked)}
            className="size-5 accent-primary"
          />
          Habilitar mensalidade
        </label>
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="casual_enabled"
            checked={casual}
            onChange={(e) => setCasual(e.target.checked)}
            className="size-5 accent-primary"
          />
          Habilitar avulso / convidado
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Mensalidade (R$)
          <Input
            name="monthly_amount"
            inputMode="decimal"
            defaultValue={moneyInput(value?.monthly_amount_cents ?? null)}
            disabled={!monthly}
            required={monthly}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Avulso e convidado (R$)
          <Input
            name="casual_amount"
            inputMode="decimal"
            defaultValue={moneyInput(value?.casual_amount_cents ?? null)}
            disabled={!casual}
            required={casual}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Dia do vencimento
          <Input
            name="due_day"
            type="number"
            min="1"
            max="31"
            step="1"
            defaultValue={value?.due_day ?? ""}
            disabled={!monthly}
            required={monthly}
          />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Informe valores com até duas casas decimais, sem separador de milhar.
        Não são criadas cobranças ou pagamentos. O ajuste de vencimento 29–31 em
        meses curtos pertence ao módulo futuro de cobrança.
      </p>
      <PeriodFields value={value} today={today} />
    </ActionForm>
  );
}
export function BillingForm({
  slug,
  value,
  members,
  today,
}: {
  slug: string;
  value?: Billing;
  members: Member[];
  today: string;
}) {
  return (
    <ActionForm
      action={saveBilling.bind(null, slug, value?.id ?? null)}
      label={value ? "Salvar classificação futura" : "Cadastrar classificação"}
    >
      {!value && (
        <label className="grid gap-2 text-sm font-medium">
          Integrante desta página
          <select
            name="player_id"
            required
            defaultValue=""
            className="form-control"
          >
            <option value="" disabled>
              Selecione o integrante
            </option>
            {members
              .filter((m) => m.players)
              .map((m) => (
                <option key={m.player_id} value={m.player_id}>
                  {m.players!.name}
                  {m.role === "guest" ? " · convidado (somente avulso)" : ""}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="grid gap-2 text-sm font-medium">
        Classificação
        <select
          name="billing_type"
          defaultValue={value?.billing_type ?? ""}
          required
          className="form-control"
        >
          <option value="" disabled>
            Selecione a classificação
          </option>
          <option value="monthly">Mensalista</option>
          <option value="casual">Avulso</option>
        </select>
      </label>
      <PeriodFields value={value} today={today} />
      <p className="text-sm text-muted-foreground">
        Convidados só podem ser avulsos. Esta classificação não gera cobrança.
      </p>
    </ActionForm>
  );
}
export function EndPeriodForm({
  slug,
  id,
  kind,
  today,
}: {
  slug: string;
  id: string;
  kind: "pricing" | "billing";
  today: string;
}) {
  return (
    <ActionForm
      action={(kind === "pricing" ? endPricing : endBilling).bind(
        null,
        slug,
        id,
      )}
      label="Agendar encerramento sem substituição"
    >
      <DateField
        name="effective_until"
        label="Fim exclusivo da vigência"
        required
        min={today}
      />
      <p className="text-sm text-muted-foreground">
        Encerramento é uma operação independente e só pode ocorrer em data
        futura. Não cria uma nova versão nem troca preços/classificações
        automaticamente.
      </p>
    </ActionForm>
  );
}
