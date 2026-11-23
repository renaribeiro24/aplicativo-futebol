"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { manageMember, type MemberActionState } from "./actions";
export function MemberForm({
  slug,
  operation,
  children,
  label,
  requestId,
  token,
  disabled = false,
}: {
  slug: string;
  operation: string;
  children?: React.ReactNode;
  label: string;
  requestId?: string;
  token?: string;
  disabled?: boolean;
}) {
  const [state, submit, pending] = useActionState(
    manageMember.bind(null, slug),
    {} as MemberActionState,
  );
  const [copied, setCopied] = useState(false);
  return (
    <form action={submit} className="min-w-0 space-y-3" aria-busy={pending}>
      <input type="hidden" name="operation" value={operation} />
      {requestId && <input type="hidden" name="request_id" value={requestId} />}
      {token && <input type="hidden" name="token" value={token} />}
      <fieldset disabled={disabled || pending} className="min-w-0 space-y-3">
        {children}
        <Button type="submit">{pending ? "Confirmando…" : label}</Button>
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
      {state.link && (
        <div className="space-y-2">
          <label className="grid gap-2 text-sm">
            Link individual de compartilhamento
            <input
              readOnly
              value={state.link}
              className="form-control min-w-0 w-full"
              onFocus={(e) => e.target.select()}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.link!);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copiado" : "Copiar link"}
          </Button>
        </div>
      )}
    </form>
  );
}
