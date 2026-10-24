/**
 * Utilitários HTTP compartilhados pelas Edge Functions (CORS, erros seguros, token).
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "capacitor://localhost",
  "https://localhost",
];

/** Origens extras via secret ALLOWED_ORIGINS (CSV), ex.: https://app.exemplo.com */
function configuredOrigins(): string[] {
  const raw = (typeof Deno !== "undefined" && Deno?.env?.get ? Deno.env.get("ALLOWED_ORIGINS") : undefined) ?? "";
  return raw
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const allowlist = [...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins()];
  if (allowlist.includes(origin)) return true;

  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    // Cloudflare Pages preview/produção
    if (url.hostname.endsWith(".pages.dev")) return true;
    return false;
  } catch {
    return false;
  }
}

/** Cabeçalhos CORS para rotas chamadas pelo browser (checkout/manage/quotes user). */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, asaas-access-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** Resposta JSON com CORS contextual e sem vazamento de detalhes internos. */
export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(req),
      ...extraHeaders,
    },
  });
}

/** Erro genérico para o cliente (detalhe só no log do runtime). */
export function safeErrorResponse(
  req: Request,
  status: number,
  publicMessage: string,
  cause?: unknown,
): Response {
  if (cause !== undefined) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.error(`[edge] ${publicMessage}`, detail);
  }
  return jsonResponse(req, { error: publicMessage }, status);
}

/** Comparação em tempo constante para tokens compartilhados (webhook). */
export async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    // Compara consigo mesmo para manter custo similar e evitar vazamento por tamanho óbvio curto.
    const dig = await crypto.subtle.digest("SHA-256", aBytes);
    await crypto.subtle.digest("SHA-256", bBytes);
    void dig;
    return false;
  }
  // Deno implementa crypto.subtle.timingSafeEqual como extensão WebCrypto
  const subtleWithTiming = crypto.subtle as unknown as {
    timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean;
  };
  if (typeof subtleWithTiming.timingSafeEqual === "function") {
    return subtleWithTiming.timingSafeEqual(aBytes, bBytes);
  }

  // Fallback de tempo constante bit a bit (resiste a timing attacks)
  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i++) {
    mismatch |= aBytes[i]! ^ bBytes[i]!;
  }
  return mismatch === 0;
}
