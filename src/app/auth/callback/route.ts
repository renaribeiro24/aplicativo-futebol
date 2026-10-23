import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/features/auth/validation";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  recoveryFailure,
  type RecoveryFailure,
} from "@/features/auth/recovery-errors";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const origin = getSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!origin)
    return NextResponse.json(
      { error: "Endereço da aplicação não configurado." },
      { status: 503, headers },
    );
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const recovery = params.get("flow") === "recovery";
  const fail = (reason: RecoveryFailure) => {
    if (recovery) console.warn("auth_callback_recovery_failed", { reason });
    return NextResponse.redirect(
      new URL(
        recovery
          ? `/forgot-password?error=${reason}`
          : "/login?error=confirmation",
        origin,
      ),
      { headers },
    );
  };
  // Do not redeem a code when the provider already reported a failure.
  // token_hash/type are not a substitute for this application's code/PKCE flow.
  if (params.has("error") || params.has("error_code"))
    return fail(recoveryFailure(params.get("error_code") ?? undefined));
  if (
    !code ||
    (recovery &&
      (params.has("token_hash") ||
        (params.has("type") && params.get("type") !== "recovery")))
  )
    return fail("invalid");
  if (!getSupabaseConfig()) return fail("unavailable");
  const flowId = params.get("sb_flow_id");
  if (flowId !== null && !/^[A-Za-z0-9_-]{8,64}$/.test(flowId))
    return fail("invalid");
  try {
    const supabase = await createClient();
    // Newer SDKs can correlate concurrent flows; never fall back to another
    // verifier when the callback explicitly identifies its flow.
    const { error } =
      flowId === null
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.exchangeCodeForSession(code, { flowId });
    if (error) return fail(recoveryFailure(error.code));
    return NextResponse.redirect(
      new URL(recovery ? "/reset-password" : "/dashboard", origin),
      { headers },
    );
  } catch {
    return fail("unavailable");
  }
}
