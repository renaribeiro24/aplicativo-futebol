import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/features/auth/validation";
import { getSupabaseConfig } from "@/lib/supabase/config";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const origin = getSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!origin)
    return NextResponse.json(
      { error: "Endereço da aplicação não configurado." },
      { status: 503, headers },
    );
  const code = request.nextUrl.searchParams.get("code");
  const recovery = request.nextUrl.searchParams.get("flow") === "recovery";
  if (getSupabaseConfig() && code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(recovery ? "/reset-password" : "/dashboard", origin),
          {
            headers,
          },
        );
    } catch {
      /* Do not expose provider details, tokens or credentials. */
    }
  }
  return NextResponse.redirect(
    new URL(
      recovery ? "/forgot-password?error=expired" : "/login?error=confirmation",
      origin,
    ),
    { headers },
  );
}
