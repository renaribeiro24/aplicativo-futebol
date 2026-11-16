"use client";
import { useState, type FormEvent } from "react";
import { LocationEditor, LocationPreview } from "./form";
import {
  emptyLocation,
  parseLocation,
  type LocationFields,
  type LocationState,
} from "./model";
import { InputError } from "../operations/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const blankState: LocationState = { ready: true, primaryId: null, venues: [] };
/** Explicit, tab-only demo. No storage, fetch, auth or persistence action here. */
export function LocationDemo() {
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<LocationFields | null>(null);
  const [revision, setRevision] = useState(0);
  function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDraft(null);
    const form = new FormData(event.currentTarget);
    try {
      const parsed = parseLocation(form);
      setDraft({
        ...emptyLocation,
        name: parsed.p_name,
        postal_code: parsed.p_postal_code,
        street: parsed.p_street,
        street_number: parsed.p_street_number,
        complement: parsed.p_complement ?? "",
        neighborhood: parsed.p_neighborhood,
        city: parsed.p_city,
        state: parsed.p_state,
        latitude:
          parsed.p_latitude === undefined ? "" : String(parsed.p_latitude),
        longitude:
          parsed.p_longitude === undefined ? "" : String(parsed.p_longitude),
      });
    } catch (cause) {
      setError(
        cause instanceof InputError
          ? cause.message
          : "Confira os campos do rascunho.",
      );
    }
  }
  return (
    <div className="space-y-6">
      <div
        role="note"
        className="rounded-xl border border-primary/40 bg-primary/5 p-5 text-sm leading-6"
      >
        <p className="font-semibold">
          Demonstração isolada — sem gravação no banco
        </p>
        <p>
          Use somente dados fictícios. Os campos e a validação são
          compartilhados com Dados gerais. Nenhum grupo ou local real é
          consultado ou alterado. O rascunho existe apenas nesta aba e é
          descartado ao recarregar.
        </p>
        <p>
          Geoapify desativado. O mapa e a navegação são serviços externos,
          abertos somente por sua escolha. A criação de agendas e partidas e a
          persistência real dependem da homologação da migration 004.2-L.
        </p>
      </div>
      <form
        method="post"
        onSubmit={validate}
        key={revision}
        className="space-y-6"
      >
        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Identificação do grupo</h2>
          <label className="grid gap-2 text-sm font-medium">
            Nome do grupo (rascunho)
            <Input name="group_name" maxLength={120} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Descrição (rascunho)
            <textarea
              name="description"
              className="form-control min-h-24"
              maxLength={1000}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            O fuso horário permanece preservado; não é editado por esta tela.
          </p>
        </section>
        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Local do futebol</h2>
          <LocationEditor
            state={blankState}
            slug="demonstracao-isolada"
            searchEnabled={false}
          />
        </section>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">Validar rascunho — não grava</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(null);
              setError("");
              setRevision((v) => v + 1);
            }}
          >
            Limpar rascunho
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="feedback-error">
          {error}
        </p>
      )}
      {draft && (
        <section
          className="space-y-4 rounded-xl border p-5"
          aria-label="Resultado da validação"
        >
          <p role="status" className="font-medium text-primary">
            Rascunho validado nesta aba. Não gravado no banco.
          </p>
          <LocationPreview value={draft} />
          <p className="text-sm text-muted-foreground">
            Esta demonstração não define um local principal real nem comprova
            persistência, autorização ou integração com agendas e partidas.
          </p>
        </section>
      )}
    </div>
  );
}
