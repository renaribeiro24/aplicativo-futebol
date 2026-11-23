"use client";
import { useEffect, useId, useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { savePrimaryLocation } from "./actions";
import {
  emptyLocation,
  locationLinks,
  states,
  type LocationFields,
  type LocationState,
} from "./model";
import type { Suggestion } from "./provider";
function isSuggestion(value: unknown): value is Suggestion {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.label === "string" &&
    Object.keys(emptyLocation).every((k) => typeof r[k] === "string")
  );
}
export function LocationPreview({ value }: { value: LocationFields }) {
  const [showMap, setShowMap] = useState(false);
  const links = locationLinks(value);
  if (!links) return null;
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="font-medium [overflow-wrap:anywhere]">{value.name}</p>
      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {[
          value.street,
          value.street_number,
          value.neighborhood,
          value.city,
          value.state,
          value.postal_code,
        ]
          .filter(Boolean)
          .join(", ")}
      </p>
      <div className="flex flex-wrap gap-4 text-sm text-primary underline">
        <a href={links.navigation} target="_blank" rel="noopener noreferrer">
          Abrir na navegação
        </a>
        {links.map && (
          <button type="button" onClick={() => setShowMap((v) => !v)}>
            {showMap ? "Ocultar mapa" : "Visualizar mapa"}
          </button>
        )}
      </div>
      {showMap && links.map && (
        <iframe
          src={links.map}
          title="Local do futebol no mapa"
          className="h-64 w-full rounded-lg border"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <p className="text-xs text-muted-foreground">
        {value.location_provider === "geoapify" && (
          <>
            <a
              href="https://www.geoapify.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Powered by Geoapify
            </a>
            {" · "}
          </>
        )}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
export function LocationEditor({
  state,
  slug,
  searchEnabled,
}: {
  state: LocationState;
  slug: string;
  searchEnabled: boolean;
}) {
  const initial = state.venues.find((v) => v.id === state.primaryId);
  const [selected, setSelected] = useState(initial?.id ?? "");
  const [values, setValues] = useState<LocationFields>(
    initial ?? emptyLocation,
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState("");
  const [active, setActive] = useState(-1);
  const listId = useId();
  useEffect(() => {
    if (!searchEnabled || !state.ready || query.trim().length < 3) {
      return;
    }
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(async () => {
      setStatus("Pesquisando…");
      try {
        const response = await fetch(`/api/groups/${slug}/locations/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: controller.signal,
          cache: "no-store",
        });
        const data: unknown = await response.json();
        const record =
          typeof data === "object" && data !== null
            ? (data as Record<string, unknown>)
            : {};
        if (!current) return;
        if (!response.ok) {
          setResults([]);
          setStatus(
            typeof record.error === "string"
              ? record.error
              : "Preencha manualmente.",
          );
          return;
        }
        if (
          !Array.isArray(record.results) ||
          !record.results.every(isSuggestion)
        )
          throw Error("Invalid search response");
        setResults(record.results);
        setActive(-1);
        setStatus(
          record.results.length
            ? "Selecione uma sugestão e revise os campos."
            : "Nenhum resultado. Preencha manualmente.",
        );
      } catch {
        if (current) {
          setResults([]);
          setStatus("Pesquisa indisponível. Preencha manualmente.");
        }
      }
    }, 450);
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, searchEnabled, slug, state.ready]);
  const choose = (r: Suggestion) => {
    const existing = state.venues.find(
      (v) =>
        !v.superseded_at &&
        v.location_provider === r.location_provider &&
        v.external_place_id === r.external_place_id,
    );
    setSelected(existing?.id ?? "");
    setValues(r);
    setResults([]);
    setQuery("");
    setStatus("Sugestão selecionada. Revise antes de salvar.");
  };
  const edit = (key: keyof LocationFields, value: string) => {
    setValues((old) => ({
      ...old,
      [key]: value,
      ...(old[key] &&
      old[key] !== value &&
      !["name", "complement", "latitude", "longitude"].includes(key)
        ? {
            latitude: "",
            longitude: "",
            location_provider: "",
            external_place_id: "",
          }
        : {}),
    }));
  };
  const selectedRecord = state.venues.find((v) => v.id === selected);
  const fields: [keyof LocationFields, string, number][] = [
    ["name", "Nome do estabelecimento ou campo", 120],
    ["postal_code", "CEP (quando disponível)", 9],
    ["street", "Logradouro", 200],
    ["street_number", "Número (quando disponível)", 30],
    ["complement", "Complemento (opcional)", 120],
    ["neighborhood", "Bairro (quando disponível)", 120],
    ["city", "Cidade", 120],
  ];
  return (
    <>
      <input
        type="hidden"
        name="expected_primary_id"
        value={state.primaryId ?? ""}
      />
      <input type="hidden" name="venue_id" value={selected} />
      <input
        type="hidden"
        name="expected_updated_at"
        value={selectedRecord?.updated_at ?? ""}
      />
      <input
        type="hidden"
        name="location_provider"
        value={values.location_provider}
      />
      <input
        type="hidden"
        name="external_place_id"
        value={values.external_place_id}
      />
      <label className="grid gap-2 text-sm font-medium">
        Cadastro do local
        <select
          className="form-control"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setValues(
              state.venues.find((v) => v.id === e.target.value) ??
                emptyLocation,
            );
            setQuery("");
            setResults([]);
            setStatus("");
          }}
        >
          <option value="">Novo local</option>
          {state.venues
            .filter((v) => !v.superseded_at)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.id === state.primaryId ? " · principal" : ""}
              </option>
            ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Pesquisar estabelecimento ou endereço
        <Input
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            active >= 0 ? `${listId}-${active}` : undefined
          }
          autoComplete="off"
          value={query}
          disabled={!searchEnabled}
          maxLength={200}
          onChange={(e) => {
            setQuery(e.target.value);
            setResults([]);
            setActive(-1);
            setStatus("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setResults([]);
              setActive(-1);
            }
            if (
              results.length &&
              (e.key === "ArrowDown" || e.key === "ArrowUp")
            ) {
              e.preventDefault();
              setActive((i) =>
                e.key === "ArrowDown"
                  ? (i + 1) % results.length
                  : i <= 0
                    ? results.length - 1
                    : i - 1,
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (active >= 0 && results[active]) choose(results[active]);
            }
          }}
        />
      </label>
      {!searchEnabled ? (
        <p className="text-sm text-muted-foreground">
          Busca externa não ativada. Você pode preencher o local manualmente.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Ao pesquisar, o texto é enviado ao Geoapify.{" "}
          <a
            href="https://www.geoapify.com/"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by Geoapify
          </a>{" "}
          · © OpenStreetMap contributors
        </p>
      )}
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
      {results.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label="Sugestões de localização"
          className="max-h-72 overflow-auto rounded-lg border"
        >
          {results.map((r, i) => (
            <button
              key={r.external_place_id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              type="button"
              onClick={() => choose(r)}
              className={`block w-full p-3 text-left text-sm hover:bg-accent ${active === i ? "bg-accent" : ""}`}
            >
              {r.name}
              <span className="block text-muted-foreground">{r.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        {fields.map(([key, label, max]) => (
          <label key={key} className="grid min-w-0 gap-2 text-sm font-medium">
            {label}
            <Input
              name={key}
              required={key === "name"}
              maxLength={max}
              value={values[key]}
              onChange={(e) => edit(key, e.target.value)}
            />
          </label>
        ))}
        <label className="grid gap-2 text-sm font-medium">
          Estado (UF)
          <select
            name="state"
            className="form-control"
            value={values.state}
            onChange={(e) => edit("state", e.target.value)}
          >
            <option value="">Não informado</option>
            {states.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </label>
        {(["latitude", "longitude"] as const).map((key) => (
          <input key={key} type="hidden" name={key} value={values[key]} />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Informe o nome e o endereço do local. Não preencha dados desconhecidos
        com valores fictícios. Edições de locais já utilizados criam uma versão
        nova; agendas e partidas anteriores ficam preservadas.
      </p>
      <LocationPreview value={values} />
    </>
  );
}
export function PrimaryLocationForm({
  state,
  slug,
  searchEnabled,
}: {
  state: LocationState;
  slug: string;
  searchEnabled: boolean;
}) {
  const primary = state.venues.find((v) => v.id === state.primaryId);
  return (
    <div className="space-y-5">
      {!state.ready && (
        <p role="status" className="text-sm text-muted-foreground">
          A atualização autorizada do banco para localização ainda está
          pendente. Nenhum local pode ser salvo nesta versão do banco.
        </p>
      )}
      <ActionForm
        action={savePrimaryLocation.bind(null, slug)}
        label="Salvar local principal"
        disabled={!state.ready}
      >
        <LocationEditor
          key={`${state.primaryId}:${primary?.updated_at ?? ""}`}
          state={state}
          slug={slug}
          searchEnabled={searchEnabled}
        />
      </ActionForm>
      {state.ready && state.venues.some((v) => v.superseded_at) && (
        <details>
          <summary className="cursor-pointer text-sm text-primary">
            Locais históricos preservados
          </summary>
          <ul className="mt-3 space-y-2">
            {state.venues
              .filter((v) => v.superseded_at)
              .map((v) => (
                <li key={v.id} className="text-sm">
                  {v.name} ·{" "}
                  {[v.street, v.city, v.state].filter(Boolean).join(", ")}
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
