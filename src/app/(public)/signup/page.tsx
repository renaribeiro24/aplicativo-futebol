import { Brand } from "@/components/layout/brand";
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
export const metadata: Metadata = { title: "Criar conta" };
export const dynamic = "force-dynamic";
export default function Signup() {
  const configured = Boolean(getSupabaseConfig());
  return (
    <div className="mx-auto max-w-lg px-5 py-12 sm:py-20">
      <Card>
        <CardHeader>
          <div className="brand-surface mb-3 rounded-lg bg-pitch p-5">
            <Brand
              variant="main"
              tone="dark"
              linked={false}
              className="mx-auto w-full max-w-sm"
            />
          </div>
          <CardTitle className="text-2xl">
            <h1>Seu lugar no grupo.</h1>
          </CardTitle>
          <CardDescription>
            Use uma senha com pelo menos 8 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!configured && <SetupNotice />}
          <AuthForm mode="signup" configured={configured} />
          <Link
            href="/confirm-email"
            className="block text-center text-sm text-primary underline underline-offset-4"
          >
            Não recebeu a confirmação?
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline underline-offset-4"
            >
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
