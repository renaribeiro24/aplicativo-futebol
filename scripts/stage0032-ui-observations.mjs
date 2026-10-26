// Next.js may cancel speculative route prefetches; never ignore other failures.
export function expectedPrefetchAbort(reason, header) {
  return reason === "net::ERR_ABORTED" && header === "1";
}
