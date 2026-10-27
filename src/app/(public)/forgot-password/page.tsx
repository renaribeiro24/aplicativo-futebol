import Link from "next/link";
import { recoveryMessage } from "@/features/auth/recovery-errors";
import { SetupNotice } from "@/components/layout/setup-notice";
import AuthForm from "@/features/auth/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export const metadata = { title: "Recuperar senha" };
export const dynamic = "force-dynamic";
export default async function Forgot({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="mx-auto max-w-lg px-5 py-12 sm:py-20">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>Vamos recuperar seu acesso.</h1>
          </CardTitle>
          <CardDescription>
            Enviaremos um link de uso único para o seu e-mail. Abra o link no
            mesmo navegador que iniciou a solicitação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!getSupabaseConfig() && <SetupNotice />}
          {query.error && (
            <p role="alert" className="feedback-error">
              {recoveryMessage(query.error)}
            </p>
          )}
          <AuthForm mode="forgot" configured={Boolean(getSupabaseConfig())} />
          <Link className="text-sm text-primary underline" href="/login">
            Voltar para entrar
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
