/**
 * Resolve o destino seguro de redirecionamento após autenticação no login.
 */
export function resolveLoginRedirect(params: {
  searchParams: URLSearchParams;
  locationState: unknown;
}): string {
  const planoParam = params.searchParams.get("plano");
  const metodoParam = params.searchParams.get("metodo");
  const checkoutQuery = new URLSearchParams();
  if (planoParam) checkoutQuery.set("plano", planoParam);
  if (metodoParam) checkoutQuery.set("metodo", metodoParam);

  const redirectParam =
    params.searchParams.get("redirect") || params.searchParams.get("returnUrl");
  const safeRedirect =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : null;

  const fallbackFrom =
    safeRedirect || (planoParam ? `/assinatura?${checkoutQuery.toString()}` : "/");

  const fromState = (
    params.locationState as { from?: { pathname?: string; search?: string } } | null
  )?.from;

  const rawFrom = fromState
    ? `${fromState.pathname ?? "/"}${fromState.search ?? ""}`
    : fallbackFrom;

  const isSettingsOrAuth =
    rawFrom.startsWith("/configuracoes") ||
    rawFrom.startsWith("/entrar") ||
    rawFrom.startsWith("/cadastro") ||
    rawFrom.startsWith("/criar-conta") ||
    rawFrom.startsWith("/recuperar-senha") ||
    rawFrom === "/mais";

  return isSettingsOrAuth ? fallbackFrom : rawFrom;
}
