export type RecoveryFailure = "context" | "expired" | "invalid" | "unavailable";

// Classify only SDK codes; never return/log provider messages, URLs or credentials.
export function recoveryFailure(code?: string): RecoveryFailure {
  if (code === "bad_code_verifier" || code === "pkce_code_verifier_not_found")
    return "context";
  if (
    code === "otp_expired" ||
    code === "flow_state_not_found" ||
    code === "flow_state_expired"
  )
    return "expired";
  return "unavailable";
}

export function recoveryMessage(reason?: string): string {
  if (reason === "context")
    return "Não foi possível concluir neste navegador. Solicite um novo link aqui e abra somente o e-mail mais recente, neste mesmo navegador.";
  if (reason === "unavailable")
    return "Não foi possível concluir a recuperação agora. Tente novamente mais tarde ou solicite um novo link.";
  return "O link não pôde ser utilizado. Solicite um novo e abra somente o e-mail mais recente neste navegador.";
}
