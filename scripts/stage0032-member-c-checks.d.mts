export const MEMBER_C_FIXTURE: Readonly<{
  user: string;
  groupA: string;
  groupB: string;
  member: string;
  slugA: string;
}>;
export function assertCIdentity(user: unknown): void;
export function assertMemberFixture(snapshot: unknown): void;
export function snapshotFingerprint(snapshot: unknown): string;
export function classifyDenied(
  result: unknown,
  allowEmpty?: boolean,
): {
  passed: boolean;
  category: string;
  status: number | null;
  code: string | null;
};
