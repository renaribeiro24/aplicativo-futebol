export type SsrReport = {
  account: string;
  scenario: string;
  route: string;
  expected: string;
  expectedStatus: number[];
  code: "NEXT_HTTP_ERROR_FALLBACK;404" | null;
  status: number | null;
  redirect: string;
  category: string;
  vercelProtection: boolean;
  privateDataPresent: boolean;
  passed: boolean;
};
export function checkSsr(options: {
  origin: string;
  sessions: {
    account: string;
    jar: Map<string, string>;
    userId: string;
    ownSlug: string;
    foreignSlug: string;
    ownName: string;
    forbiddenMarkers: string[];
  }[];
  onCheck: (report: SsrReport) => void;
  fetcher?: typeof fetch;
}): Promise<boolean>;
