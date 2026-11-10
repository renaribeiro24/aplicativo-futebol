import type { Outcome } from "./stage0042-http-guards.mjs";
export const PROBES: string[][];
export type ProbeResult = {
  endpoint: string;
  status: number;
  category: string;
  connectivityConfirmed: boolean;
  authorizationConfirmed: boolean;
  canAuthenticate: boolean;
  code: string | null;
};
export function classifyProbe(
  endpoint: string,
  requestedUrl: string,
  response: Response,
): Promise<ProbeResult>;
export const READ_TABLES: string[];
export function authenticatedReadPreflight(
  probe: (actor: string, table: string) => Promise<Outcome>,
  onPass?: (actor: string, table: string) => void,
): Promise<void>;
