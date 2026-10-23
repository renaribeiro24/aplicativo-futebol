import Link from "next/link";
import AuthForm from "@/features/auth/auth-form";
import { getCurrentUser } from "@/features/auth/session";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export const metadata = { title: "Redefinir senha" };
export const dynamic = "force-dynamic";
export default async function Reset() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-lg px-5 py-12 sm:py-20">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Uma nova senha para seguir em campo.</h1>
          </CardTitle>
          <CardDescription>
            Use de 8 a 128 caracteres. Sua senha é processada somente pelo
            Supabase Auth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {user ? (
            <AuthForm mode="reset" configured />
          ) : (
            <>
              <p role="alert" className="text-sm text-destructive">
                Não há uma sessão válida. Solicite um novo link de recuperação.
              </p>
              <Link href="/forgot-password" className="text-primary underline">
                Solicitar novo link
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
