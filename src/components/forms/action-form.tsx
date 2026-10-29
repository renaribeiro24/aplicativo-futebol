"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AuthState } from "@/types/auth";
export function ActionForm({
  action,
  label,
  children,
  requestId,
}: {
  requestId?: string;
  action: (state: AuthState, form: FormData) => Promise<AuthState>;
  label: string;
  children: React.ReactNode;
}) {
  const [stableRequest] = useState(requestId);
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="space-y-5" aria-busy={pending}>
      {stableRequest && (
        <input type="hidden" name="request_id" value={stableRequest} />
      )}
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
        {children}
        <Button type="submit">{pending ? "Salvando…" : label}</Button>
      </fieldset>
      {state.error && (
        <p role="alert" className="feedback-error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="feedback-success">
          {state.message}
        </p>
      )}
    </form>
  );
}
