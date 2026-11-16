/** Demo never inherits NODE_ENV=production as deployment authorization. */
export function locationDemoAvailable(
  env: {
    VERCEL_ENV?: string;
    VERCEL_GIT_COMMIT_REF?: string;
  } = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  },
) {
  return (
    env.VERCEL_ENV === "preview" &&
    env.VERCEL_GIT_COMMIT_REF === "feat/stage0042-operational"
  );
}
