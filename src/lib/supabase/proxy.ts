import { getAuthCookieOptions } from "./cookies";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseConfig } from "./config";
export async function refreshSession(
  request: NextRequest,
  config: SupabaseConfig,
) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.key, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });
  // getUser validates against Auth; cookie presence and user_metadata never authorize access.
  const { data, error } = await supabase.auth.getUser();
  if (
    (error || !data.user) &&
    (request.nextUrl.pathname === "/dashboard" ||
      request.nextUrl.pathname.startsWith("/dashboard/") ||
      request.nextUrl.pathname === "/groups" ||
      request.nextUrl.pathname.startsWith("/groups/") ||
      request.nextUrl.pathname === "/profile")
  ) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    ["Cache-Control", "Expires", "Pragma"].forEach((name) => {
      const value = response.headers.get(name);
      if (value) redirect.headers.set(name, value);
    });
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
