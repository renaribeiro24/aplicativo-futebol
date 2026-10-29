import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { refreshSession } from "@/lib/supabase/proxy";
export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) {
    const response = NextResponse.next({ request });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return refreshSession(request, config);
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/groups/:path*",
    "/profile",
    "/forgot-password",
    "/confirm-email",
    "/reset-password",
    "/login",
    "/signup",
    "/auth/:path*",
    "/api/:path*",
  ],
};
