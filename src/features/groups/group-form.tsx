"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { createGroup } from "./actions";
import { slugify } from "./validation";
export function GroupForm({ requestId }: { requestId: string }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [edited, setEdited] = useState(false);
  return (
    <ActionForm
      action={createGroup}
      label="Criar meu grupo"
      requestId={requestId}
    >
      <label className="grid gap-2 text-sm font-medium">
        Nome do grupo
        <Input
          name="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!edited) setSlug(slugify(e.target.value));
          }}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Identificador
        <Input
          name="slug"
          required
          minLength={3}
          maxLength={64}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={slug}
          onChange={(e) => {
            setEdited(true);
            setSlug(e.target.value);
          }}
        />
        <span className="font-normal text-muted-foreground">
          Letras minúsculas, números e hífens. Será usado no endereço do grupo.
        </span>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Descrição (opcional)
        <textarea
          name="description"
          maxLength={1000}
          rows={3}
          className="form-control min-h-28"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Fuso horário
        <Input
          name="timezone"
          required
          defaultValue="America/Sao_Paulo"
          maxLength={100}
        />
        <span className="font-normal text-muted-foreground">
          Nome IANA, por exemplo America/Sao_Paulo ou Europe/Lisbon.
        </span>
      </label>
    </ActionForm>
  );
}
