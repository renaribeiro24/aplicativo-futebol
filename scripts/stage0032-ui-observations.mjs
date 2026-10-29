// Next.js may cancel speculative route prefetches; never ignore other failures.
export function expectedPrefetchAbort(reason, header) {
  return reason === "net::ERR_ABORTED" && header === "1";
}

// Fixed categories only: never return URL, query, headers, body or error text.
export function networkFailureSummary(input) {
  const reasons = [
    "net::ERR_ABORTED",
    "net::ERR_FAILED",
    "net::ERR_TIMED_OUT",
    "net::ERR_NETWORK_CHANGED",
    "net::ERR_CONNECTION_RESET",
    "net::ERR_CONNECTION_CLOSED",
    "net::ERR_CONNECTION_REFUSED",
    "net::ERR_INTERNET_DISCONNECTED",
    "net::ERR_NAME_NOT_RESOLVED",
    "net::ERR_HTTP2_PROTOCOL_ERROR",
    "net::ERR_CONNECTION_TIMED_OUT",
    "net::ERR_BLOCKED_BY_CLIENT",
    "net::ERR_ACCESS_DENIED",
    "net::ERR_CERT_AUTHORITY_INVALID",
    "net::ERR_PROXY_CONNECTION_FAILED",
    "net::ERR_TUNNEL_CONNECTION_FAILED",
  ];
  const types = [
    "document",
    "stylesheet",
    "image",
    "media",
    "font",
    "script",
    "xhr",
    "fetch",
    "eventsource",
    "websocket",
    "manifest",
    "other",
  ];
  let resource = "unknown";
  try {
    const u = new URL(input.url);
    resource =
      u.origin !== input.origin
        ? "external"
        : u.pathname.startsWith("/_next/")
          ? "static_asset"
          : u.pathname.startsWith("/api/")
            ? "app_api"
            : "app_route";
  } catch {
    /* no raw input */
  }
  return {
    reason: reasons.includes(input.reason) ? input.reason : "other",
    type: types.includes(input.type) ? input.type : "other",
    method: ["GET", "POST", "HEAD", "OPTIONS"].includes(input.method)
      ? input.method
      : "other",
    resource,
    prefetch: input.prefetchHeader === "1",
    navigation: input.navigation === true,
    startedInPreviousStep: input.startedInPreviousStep === true,
  };
}
