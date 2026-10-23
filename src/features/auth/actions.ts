"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  readCredentials,
  isValidSignup,
  isValidEmail,
  getSiteOrigin,
} from "./validation";
import type { AuthState } from "@/types/auth";
const unavailable = "Autenticação ainda não configurada neste ambiente.";
export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  if (!getSupabaseConfig()) return { error: unavailable };
  const { email, password } = readCredentials(form);
  if (!isValidEmail(email) || !password || password.length > 128)
    return { error: "Informe seu e-mail e senha." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      return {
        error:
          "Não foi possível entrar. Confira seus dados e a confirmação do e-mail.",
      };
  } catch {
    return {
      error:
        "Serviço de autenticação indisponível. Tente novamente mais tarde.",
    };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  if (!getSupabaseConfig()) return { error: unavailable };
  const { email, password } = readCredentials(form);
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 100 || !isValidSignup(email, password))
    return {
      error:
        "Informe seu nome (até 100 caracteres), e-mail válido e senha de 8 a 128 caracteres.",
    };
  const origin = getSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!origin)
    return { error: "O endereço da aplicação ainda não foi configurado." };
  let hasSession = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: { display_name: name },
      },
    });
    if (error)
      return {
        error: "Não foi possível criar a conta. Tente novamente mais tarde.",
      };
    hasSession = Boolean(data.session);
  } catch {
    return {
      error:
        "Serviço de autenticação indisponível. Tente novamente mais tarde.",
    };
  }
  if (hasSession) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }
  return {
    message:
      "Se o cadastro estiver disponível, você receberá um e-mail. Confirme seu endereço antes de entrar.",
  };
}
export async function logout() {
  if (!getSupabaseConfig()) redirect("/login");
  let failed = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) redirect("/dashboard?error=logout");
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!getSupabaseConfig()) return { error: unavailable };
  const email = String(form.get("email") ?? "").trim();
  if (!isValidEmail(email)) return { error: "Informe um e-mail válido." };
  const origin = getSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!origin)
    return { error: "O endereço da aplicação ainda não foi configurado." };
  try {
    const db = await createClient();
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?flow=recovery`,
    });
    if (error)
      return {
        error:
          "Não foi possível enviar a solicitação agora. Aguarde e tente novamente.",
      };
  } catch {
    return { error: "Serviço indisponível. Tente novamente mais tarde." };
  }
  return {
    message:
      "Se houver uma conta elegível, você receberá um link para redefinir a senha. Abra somente o e-mail mais recente neste mesmo navegador e endereço do site. Evite solicitar outro link antes de concluir.",
  };
}
export async function resetPassword(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!getSupabaseConfig()) return { error: unavailable };
  const password = String(form.get("password") ?? "");
  if (
    password.length < 8 ||
    password.length > 128 ||
    password !== form.get("confirmation")
  )
    return { error: "Use de 8 a 128 caracteres e confirme a mesma senha." };
  try {
    const db = await createClient();
    const verified = await db.auth.getUser();
    if (verified.error || !verified.data.user)
      return {
        error: "Sua sessão expirou. Solicite um novo link de recuperação.",
      };
    const { error } = await db.auth.updateUser({ password });
    if (error)
      return {
        error:
          "Não foi possível atualizar. Solicite um novo link se ele tiver expirado.",
      };
  } catch {
    return {
      error:
        "Não foi possível confirmar a atualização. Tente entrar com sua nova senha antes de repetir.",
    };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard?notice=password");
}

export async function resendConfirmation(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!getSupabaseConfig()) return { error: unavailable };
  const email = String(form.get("email") ?? "").trim();
  const origin = getSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!isValidEmail(email)) return { error: "Informe um e-mail válido." };
  if (!origin)
    return { error: "O endereço da aplicação ainda não foi configurado." };
  try {
    const db = await createClient();
    const { error } = await db.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error)
      return {
        error:
          "Não foi possível solicitar a confirmação agora. Aguarde e tente novamente.",
      };
  } catch {
    return { error: "Serviço indisponível. Tente novamente mais tarde." };
  }
  return {
    message:
      "Se houver um cadastro aguardando confirmação, você receberá um novo link. Abra-o neste mesmo navegador.",
  };
}
