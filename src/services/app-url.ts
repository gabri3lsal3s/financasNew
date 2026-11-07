/**
 * Helper universal de resolução de URL pública da aplicação.
 *
 * Garante que redirecionamentos de autenticação (confirmação de e-mail,
 * redefinição de senha), links públicos compartilháveis (Racha de Contas /r/:token,
 * Convites Familiares /convite-familiar/:token, Metas Coletivas /meta/:token,
 * Orçamento Familiar /orcamento-familiar/:token e Simuladores) apontem para
 * uma URL pública canônica acessível tanto na Web quanto em clientes nativos
 * (Capacitor/Android), onde window.location.origin resolve como 'capacitor://localhost',
 * 'https://localhost' ou 'http://localhost'.
 */
export function getPublicAppUrl(path = ""): string {
  const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL ?? "").trim();
  const base =
    publicSiteUrl ||
    (typeof window !== "undefined" &&
    window.location.origin.startsWith("http") &&
    !window.location.origin.includes("localhost") &&
    !window.location.origin.includes("127.0.0.1")
      ? window.location.origin
      : "https://axisfinance.app");
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${cleanBase}${cleanPath}`;
}
