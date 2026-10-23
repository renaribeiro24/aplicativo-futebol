import { getCurrentUser } from "@/features/auth/session";
import { getSupabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!getSupabaseConfig())
    return Response.json(
      { error: "Autenticação não configurada" },
      { status: 503, headers },
    );
  const user = await getCurrentUser();
  if (!user)
    return Response.json(
      { error: "Não autenticado" },
      { status: 401, headers },
    );
  return Response.json({ id: user.id, email: user.email }, { headers });
}
