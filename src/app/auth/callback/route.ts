import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const code = request.nextUrl.searchParams.get("code");
  if (getSupabaseConfig() && code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(new URL("/dashboard", request.url), {
          headers,
        });
    } catch {
      /* Do not expose provider details, tokens or credentials. */
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation", request.url),
    { headers },
  );
}
