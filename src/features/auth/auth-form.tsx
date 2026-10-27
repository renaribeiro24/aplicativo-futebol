"use client";
import { useActionState } from "react";
import {
  login,
  signup,
  requestPasswordReset,
  resetPassword,
  resendConfirmation,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function AuthForm({
  mode,
  configured,
}: {
  mode: "login" | "signup" | "forgot" | "reset" | "confirm";
  configured: boolean;
}) {
  const actions = {
    login,
    signup,
    forgot: requestPasswordReset,
    reset: resetPassword,
    confirm: resendConfirmation,
  };
  const labels = {
    login: "Entrar",
    signup: "Criar conta",
    forgot: "Enviar link de recuperação",
    reset: "Salvar nova senha",
    confirm: "Reenviar confirmação",
  };
  const [state, action, pending] = useActionState(actions[mode], {});
  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      <fieldset
        disabled={!configured || pending}
        className="space-y-5 disabled:opacity-60"
      >
        {mode === "signup" && (
          <label className="grid gap-2 text-sm font-medium">
            Seu nome
            <Input name="name" autoComplete="name" required maxLength={100} />
          </label>
        )}
        {mode !== "reset" && (
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
        )}
        {(mode === "login" || mode === "signup" || mode === "reset") && (
          <label htmlFor="password" className="grid gap-2 text-sm font-medium">
            Senha
            <Input
              id="password"
              name="password"
              type="password"
              required
              maxLength={128}
              minLength={mode === "login" ? 1 : 8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
        )}
        {mode === "reset" && (
          <label className="grid gap-2 text-sm font-medium">
            Confirmar senha
            <Input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </label>
        )}
        <Button className="w-full" type="submit">
          {pending ? "Aguarde…" : labels[mode]}
        </Button>
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
