"use client";
import { useActionState } from "react";
import { login, signup } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function AuthForm({
  mode,
  configured,
}: {
  mode: "login" | "signup";
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(
    mode === "login" ? login : signup,
    {},
  );
  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      <fieldset
        disabled={!configured || pending}
        className="space-y-5 disabled:opacity-60"
      >
        <label htmlFor="email" className="grid gap-2 text-sm font-medium">
          E-mail
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
          />
        </label>
        <label htmlFor="password" className="grid gap-2 text-sm font-medium">
          Senha
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : 1}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
          />
        </label>
        <Button className="w-full" type="submit">
          {pending ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}
    </form>
  );
}
