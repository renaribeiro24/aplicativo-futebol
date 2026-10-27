import Link from "next/link";
import type { Metadata } from "next";
import AuthForm from "@/features/auth/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/layout/setup-notice";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const configured = Boolean(getSupabaseConfig());
  return (
    <div className="mx-auto max-w-lg px-5 py-12 sm:py-20">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>Bom ter você por aqui.</h1>
          </CardTitle>
          <CardDescription>
            Entre para acessar seu espaço de futebol.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!configured && <SetupNotice />}
          {params.error && (
            <p role="alert" className="feedback-error">
              Não foi possível confirmar o acesso. O link pode ser inválido ou
              ter expirado.
            </p>
          )}
          <AuthForm mode="login" configured={configured} />
          <Link
            href="/confirm-email"
            className="block text-center text-sm text-primary underline underline-offset-4"
          >
            Reenviar confirmação de e-mail
          </Link>
          <Link
            href="/forgot-password"
            className="block text-center text-sm text-primary underline underline-offset-4"
          >
            Esqueci minha senha
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link
              href="/signup"
              className="font-medium text-primary underline underline-offset-4"
            >
              Cadastre-se
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
