export const PROJECT_URL: string;
export const REQUIRED: string[];
export function assertBranch(branch: string): void;
export type Env = Record<string, string | undefined>;
export type Actor = {
  user: { id: string; email_confirmed_at?: string; is_anonymous?: boolean };
  player: string;
  token: string;
};
export type Outcome = {
  status: number;
  data?: unknown;
  error?: { code?: string } | null;
};
export type Manifest = {
  version: number;
  run: string;
  project: string;
  groups: { id: string; slug: string }[];
  identities: { user: string; player: string }[];
};
export function configuration(env: Env): {
  present: Record<string, boolean>;
  targetValid: boolean;
  publishableKey: boolean;
  syntheticDeclaration: boolean;
  creationAuthorized: boolean;
};
export function assertConfiguration(env: Env): void;
export function uuid(value: unknown): string;
export function assertIdentities(actors: Actor[]): void;
export function denied(
  result: Outcome,
  codes?: string[],
  allowEmpty?: boolean,
): boolean;
export function verifyDenied(
  operation: () => Promise<Outcome>,
  before: unknown,
  readAfter: () => Promise<unknown>,
  codes?: string[],
  allowEmpty?: boolean,
): Promise<{ status: number; code: string | null; unchanged: boolean }>;
export function validateManifest(
  m: Manifest,
  run: string,
  actors?: Actor[],
): void;
export function membershipSeed(m: Manifest): string;
export function snapshotFingerprint(value: unknown): string;
