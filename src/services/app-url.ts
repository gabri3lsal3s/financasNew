/**
 * Helper universal de resolução de URL pública da aplicação.
 *
 * Garante que redirecionamentos de autenticação (confirmação de e-mail,
 * redefinição de senha) apontem para uma URL pública e acessível tanto no
 * ambiente Web convencional quanto em clientes nativos (Capacitor/Android),
 * onde window.location.origin resolve como 'capacitor://localhost' ou 'http://localhost'.
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
