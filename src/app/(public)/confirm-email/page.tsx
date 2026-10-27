import Link from "next/link";
import AuthForm from "@/features/auth/auth-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export const metadata = { title: "Confirmar e-mail" };
export const dynamic = "force-dynamic";
export default function ConfirmEmail() {
  const configured = Boolean(getSupabaseConfig());
  return (
    <div className="mx-auto max-w-lg px-5 py-12 sm:py-20">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>Confirme seu lugar no grupo.</h1>
          </CardTitle>
          <CardDescription>
            Se o link expirou ou não chegou, solicite outro. Abra o e-mail neste
            mesmo navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!configured && <SetupNotice />}
          <AuthForm mode="confirm" configured={configured} />
          <Link href="/login" className="text-sm text-primary underline">
            Voltar para entrar
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
