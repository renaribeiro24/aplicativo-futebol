export function expectedPrefetchAbort(
  reason: string | undefined,
  header: string | undefined,
): boolean;
export function networkFailureSummary(input: {
  url?: string;
  origin: string;
  reason?: string;
  type?: string;
  method?: string;
  prefetchHeader?: string;
  navigation?: boolean;
  startedInPreviousStep?: boolean;
}): {
  reason: string;
  type: string;
  method: string;
  resource: string;
  prefetch: boolean;
  navigation: boolean;
  startedInPreviousStep: boolean;
};
