/**
 * Utilitários HTTP compartilhados pelas Edge Functions (CORS, erros seguros, sanitização PCI/PII, token).
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

function getHttpEnv(key: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno?.env?.get) {
    return Deno.env.get(key);
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

const DEFAULT_PROD_ORIGINS = [
  "capacitor://localhost",
  "https://localhost",
  "https://axir.com.br",
  "https://www.axir.com.br",
];

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

export function isProductionEnvironment(): boolean {
  const env = (getHttpEnv("ASAAS_ENVIRONMENT") ?? "").trim().toLowerCase();
  if (env === "production") return true;
  if (env === "sandbox" || env === "development" || env === "test") return false;
  const apiUrl = (getHttpEnv("ASAAS_API_URL") ?? "").trim().toLowerCase();
  if (apiUrl.includes("api.asaas.com") && !apiUrl.includes("sandbox")) return true;
  return false;
}

/** Origens extras via secret ALLOWED_ORIGINS (CSV), ex.: https://app.exemplo.com */
function configuredOrigins(): string[] {
  const raw = getHttpEnv("ALLOWED_ORIGINS") ?? "";
  return raw
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const isProd = isProductionEnvironment();
  const allowlist = isProd
    ? [...DEFAULT_PROD_ORIGINS, ...configuredOrigins()]
    : [...DEFAULT_PROD_ORIGINS, ...DEFAULT_DEV_ORIGINS, ...configuredOrigins()];

  if (allowlist.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") {
      return false;
    }

    if (
      parsed.hostname === "axir.com.br" ||
      parsed.hostname.endsWith(".axir.com.br")
    ) {
      return true;
    }

    if (
      !isProd &&
      (parsed.hostname === "financasnew.pages.dev" ||
        parsed.hostname.endsWith(".financasnew.pages.dev"))
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** Cabeçalhos CORS para rotas chamadas pelo browser (checkout/manage/quotes user). */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/**
 * Extrai o IP real do cliente priorizando cabeçalhos confiáveis de borda (Cloudflare / proxy reverso),
 * evitando spoofing via x-forwarded-for.
 */
export function extractClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "";
}

/**
 * Mascara endereço de e-mail para logs seguros (LGPD).
 */
export function maskEmailForLog(email: string): string {
  const clean = (email || "").trim();
  const atIdx = clean.indexOf("@");
  if (atIdx <= 0) return "***";
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx + 1);
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * Sanitiza strings livres contra vazamento de PAN (13-19 dígitos), CVV/CCV/CVC,
 * CPF/CNPJ, e-mails e telefones em logs (PCI-DSS + LGPD).
 */
export function sanitizeLogString(input: string): string {
  if (!input || typeof input !== "string") return "";

  let out = input;

  // 1. Pares chave-valor com CVV/CCV/CVC/securityCode
  out = out.replace(
    /((?:["']?)(?:ccv|cvv|cvc|security[_-]?code)(?:["']?)\s*[:=]\s*["']?)(\d{3,4})(["']?)/gi,
    "$1***$3",
  );

  // 2. Pares chave-valor com CPF/CNPJ numéricos
  out = out.replace(
    /((?:["']?)(?:cpf|cpfcnpj|cpf_cnpj)(?:["']?)\s*[:=]\s*["']?)(\d{11,14})(["']?)/gi,
    "$1***.***.***-**$3",
  );

  // 3. CPFs formatados (XXX.XXX.XXX-XX)
  out = out.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "***.***.***-**");

  // 4. Números de cartão (PAN 13 a 19 dígitos, contínuos ou agrupados por espaço/hífen)
  out = out.replace(/(?<![a-fA-F0-9_-])(?:\d[ -]?){12,18}\d(?![a-fA-F0-9_-])/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return match;
    return `**** **** **** ${digits.slice(-4)}`;
  });

  // 5. E-mails
  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (email) =>
    maskEmailForLog(email),
  );

  // 6. Pares chave-valor de telefone (dígitos contínuos ou formatados)
  out = out.replace(
    /((?:["']?)(?:phone|mobilephone|mobile_phone|telefone)(?:["']?)\s*[:=]\s*["']?)(\+?\d[\d\s().-]{8,16}\d)(["']?)/gi,
    "$1(XX) *****-****$3",
  );

  // 7. Telefones brasileiros com DDD entre parênteses ou prefixo +55
  out = out.replace(/(?:\+?55\s?)?\(\d{2}\)\s?\d{4,5}-?\d{4}\b/g, "(XX) *****-****");

  return out;
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

/** Erro genérico para o cliente (detalhe sanitizado só no log do runtime). */
export function safeErrorResponse(
  req: Request,
  status: number,
  publicMessage: string,
  cause?: unknown,
): Response {
  if (cause !== undefined) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.error(`[edge] ${publicMessage}`, sanitizeLogString(detail));
  }
  return jsonResponse(req, { error: publicMessage }, status);
}

/**
 * Comparação estritamente em tempo constante para tokens compartilhados (webhook / auth).
 * Hasheia ambos os inputs com SHA-256 para uniformizar o comprimento em 32 bytes e eliminar
 * qualquer vazamento de comprimento por canais laterais de temporização (RFC 2104 / timing-safe).
 */
export async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(a)));
  const bHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(b)));

  // Deno implementa crypto.subtle.timingSafeEqual como extensão WebCrypto
  const subtleWithTiming = crypto.subtle as unknown as {
    timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean;
  };
  if (typeof subtleWithTiming.timingSafeEqual === "function") {
    return subtleWithTiming.timingSafeEqual(aHash, bHash);
  }

  // Fallback de tempo constante bit a bit em 32 bytes (resiste a timing attacks)
  let mismatch = 0;
  for (let i = 0; i < aHash.length; i++) {
    mismatch |= aHash[i]! ^ bHash[i]!;
  }
  return mismatch === 0;
}
