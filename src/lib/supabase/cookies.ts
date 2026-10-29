import type { CookieOptions } from "@supabase/ssr";

// Use the same flags for browser, actions/callbacks and proxy refreshes.
// Keep HTTP localhost development usable; deployed builds always require HTTPS.
export function getAuthCookieOptions(): Pick<CookieOptions, "secure"> {
  let https = false;
  try {
    https =
      new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").protocol === "https:";
  } catch {
    // Missing/invalid configuration never relaxes a deployed cookie.
  }
  return { secure: process.env.NODE_ENV === "production" || https };
}
