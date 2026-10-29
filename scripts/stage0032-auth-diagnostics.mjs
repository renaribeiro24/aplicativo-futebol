function redact(value, secrets) {
  let message = String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replace(
        new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        "<redacted>",
      );
    }
  }
  return message
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "<jwt>")
    .replace(/\bBearer\s+\S+/gi, "Bearer <redacted>")
    .replace(
      /\b(access|refresh)[_-]?token\s*[:=]\s*[^,\s;]+/gi,
      "$1_token=<redacted>",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "<email>")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 300);
}

export function describeAuthFailure(error, secrets = []) {
  const isSecret = (value) =>
    typeof value === "string" &&
    secrets.some(
      (secret) =>
        typeof secret === "string" &&
        secret.length > 0 &&
        secret.toLocaleLowerCase() === value.toLocaleLowerCase(),
    );
  const detail = {
    name:
      typeof error?.name === "string" &&
      /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name) &&
      !isSecret(error.name)
        ? error.name
        : undefined,
    code:
      typeof error?.code === "string" &&
      /^[A-Za-z0-9_-]{1,80}$/.test(error.code) &&
      !isSecret(error.code)
        ? error.code
        : undefined,
    status:
      Number.isInteger(error?.status) &&
      error.status >= 0 &&
      error.status <= 599
        ? error.status
        : undefined,
    message:
      typeof error?.message === "string"
        ? redact(error.message, secrets)
        : undefined,
  };

  return Object.fromEntries(
    Object.entries(detail).filter(([, value]) => value !== undefined),
  );
}
