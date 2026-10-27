import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  // The exception is dev-server-only, never baked into a build or next start.
  if (
    phase !== PHASE_DEVELOPMENT_SERVER ||
    process.env.CODESPACES !== "true" ||
    process.env.VERCEL
  ) {
    return {};
  }

  const name = process.env.CODESPACE_NAME ?? "";
  const forwardingDomain =
    process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";
  // One DNS label, leaving room for "-3000"; no URLs, ports or wildcard input.
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(name) ||
    forwardingDomain !== "app.github.dev"
  ) {
    return {};
  }

  return {
    // Dev assets use Origin.hostname. This is NOT the Server Actions CSRF list.
    allowedDevOrigins: [`${name}-3000.app.github.dev`],
    experimental: {
      serverActions: {
        // Next compares Origin.host, not x-forwarded-host, to this list.
        // Exact reported Origin, including its port; no wildcard or production host.
        allowedOrigins: ["localhost:3000"],
      },
    },
  };
}
