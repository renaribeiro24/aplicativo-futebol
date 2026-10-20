"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { readCredentials, isValidSignup, getSiteOrigin } from "./validation";
import type { AuthState } from "@/types/auth";
const unavailable = "Autenticação ainda não configurada neste ambiente.";
export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  if (!getSupabaseConfig()) return { error: unavailable };
  const { email, password } = readCredentials(form);
  if (!email || !password) return { error: "Informe seu e-mail e senha." };
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
  if (!isValidSignup(email, password))
    return {
      error:
        "Informe um e-mail válido e uma senha com pelo menos 8 caracteres.",
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
      options: { emailRedirectTo: `${origin}/auth/callback` },
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
