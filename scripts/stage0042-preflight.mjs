import assert from "node:assert/strict";
import { PROJECT_URL } from "./stage0042-http-guards.mjs";
export const PROBES = [
  ["auth", "/auth/v1/health"],
  ["data_api", "/rest/v1/groups?select=id&limit=0"],
];
export async function classifyProbe(endpoint, requestedUrl, response) {
  const result = {
    endpoint,
    status: response.status,
    category: "unverified_response",
    connectivityConfirmed: false,
    authorizationConfirmed: false,
    canAuthenticate: false,
    code: null,
  };
  const probe = PROBES.find(([name]) => name === endpoint);
  // Pin both request and final response; a proxy/gateway login or redirect is not PostgreSQL evidence.
  if (
    !probe ||
    requestedUrl !== PROJECT_URL + probe[1] ||
    response.url !== requestedUrl ||
    response.redirected
  )
    return { ...result, category: "unexpected_response_origin" };
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      response.headers.get("content-type") ?? "",
    )
  )
    return { ...result, category: "non_json_response" };
  let body;
  try {
    body = await response.json();
  } catch {
    return { ...result, category: "invalid_json" };
  }
  if (endpoint === "auth") {
    if (
      response.status === 200 &&
      body?.name === "GoTrue" &&
      typeof body.version === "string" &&
      body.version.length > 0
    )
      return {
        ...result,
        category: "auth_service_reachable",
        connectivityConfirmed: true,
        canAuthenticate: true,
      };
    return { ...result, category: "auth_service_unverified" };
  }
  // Exact PostgREST PostgreSQL-error envelope for the deliberately unprivileged groups probe.
  if (
    response.status === 401 &&
    body?.code === "42501" &&
    body.message === "permission denied for table groups" &&
    body.details === null &&
    body.hint === null
  )
    return {
      ...result,
      category: "anonymous_access_denied",
      code: "42501",
      connectivityConfirmed: true,
      canAuthenticate: true,
    };
  if (response.status === 200 && Array.isArray(body))
    return {
      ...result,
      category: "unexpected_anonymous_read_access",
      connectivityConfirmed: true,
    };
  const code =
    typeof body?.code === "string" &&
    /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(body.code)
      ? body.code
      : null;
  return {
    ...result,
    category:
      response.status === 401
        ? "unverified_auth_denial"
        : "unexpected_data_api_response",
    code,
  };
}
export const READ_TABLES = [
  "groups",
  "group_members",
  "venues",
  "group_schedules",
  "group_pricing_policies",
  "member_billing_terms",
];
// Called only after all three real Auth identities have been confirmed. Never writes rows.
export async function authenticatedReadPreflight(probe, onPass = () => {}) {
  for (const actor of ["A", "B", "C"])
    for (const table of READ_TABLES) {
      const result = await probe(actor, table);
      assert(
        result.status === 200 &&
          !result.error &&
          Array.isArray(result.data) &&
          result.data.length === 0,
        "Authenticated read preflight failed; fixtures must not be created",
      );
      onPass(actor, table);
    }
}
