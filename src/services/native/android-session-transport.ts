import { z } from "zod";

/**
 * Hosts oficiais autorizados no AndroidManifest.xml para App Links HTTPS.
 */
export const ALLOWED_ANDROID_APP_LINK_HOSTS = [
  "axir.com.br",
  "www.axir.com.br",
  "financasnew.gabrielisaacsales.workers.dev",
  "axisfinance.app",
  "www.axisfinance.app",
  "com.guiafinanceiro.app",
] as const;

const ALLOWED_HOST_SET = new Set<string>(ALLOWED_ANDROID_APP_LINK_HOSTS);

/**
 * Conjunto fechado de operações permitidas no transporte de sessão Android.
 */
export const ANDROID_SESSION_TRANSPORT_OPERATIONS = [
  "handoff",
  "verify_app_link",
  "sync_installation",
  "open_route",
] as const;

export type AndroidSessionTransportOperation =
  (typeof ANDROID_SESSION_TRANSPORT_OPERATIONS)[number];

const ALLOWED_OPERATION_SET = new Set<string>(ANDROID_SESSION_TRANSPORT_OPERATIONS);

/**
 * Prefixos de rota permitidos para App Links HTTPS do Axir.
 */
export const ALLOWED_APP_LINK_PATH_PREFIXES = [
  "/r",
  "/meta",
  "/convite-familiar",
  "/orcamento-familiar",
  "/viagem",
  "/ferramentas",
  "/lembretes",
  "/transacoes",
  "/cartoes",
  "/dividas",
  "/configuracoes",
] as const;

const BLOCKED_QUERY_PARAMS = new Set<string>([
  "redirect",
  "redirect_to",
  "redirecturl",
  "returnurl",
  "next",
  "continue",
  "account",
  "switchaccount",
  "user_id",
  "userid",
  "token",
  "access_token",
  "refresh_token",
]);

const INSTALLATION_ID_REGEX = /^[a-zA-Z0-9._-]{8,128}$/;

export type AndroidSessionTransportRejectCode =
  | "invalid_url"
  | "insecure_scheme"
  | "userinfo_not_allowed"
  | "port_not_allowed"
  | "host_not_allowed"
  | "path_not_allowed"
  | "blocked_query_param"
  | "invalid_operation"
  | "invalid_installation_id"
  | "invalid_recipient_version"
  | "invalid_payload";

export type AndroidAppLinkValidationResult =
  | {
      valid: true;
      url: URL;
      host: string;
      pathname: string;
    }
  | {
      valid: false;
      code: AndroidSessionTransportRejectCode;
      error: string;
    };

export interface AndroidSessionTransportRequest {
  operation: AndroidSessionTransportOperation;
  targetUrl: string;
  installationId: string;
  recipientVersion?: number;
}

export type AndroidSessionTransportValidationResult =
  | {
      ok: true;
      data: {
        operation: AndroidSessionTransportOperation;
        url: URL;
        host: string;
        pathname: string;
        installationId: string;
        recipientVersion: number;
      };
    }
  | {
      ok: false;
      code: AndroidSessionTransportRejectCode;
      error: string;
    };

const transportRequestSchema = z.object({
  operation: z.string().trim().min(1),
  targetUrl: z.string().trim().min(1),
  installationId: z.string().trim().min(8).max(128),
  recipientVersion: z.number().int().min(1).optional(),
});

function isAllowedAppLinkPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.includes("//") || pathname.includes("..") || pathname.includes("\\")) {
    return false;
  }
  return ALLOWED_APP_LINK_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Valida estritamente um App Link HTTPS contra o contrato de hosts, caminho e query params.
 */
export function validateAndroidAppLinkHttps(rawUrl: string): AndroidAppLinkValidationResult {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, code: "invalid_url", error: "URL de destino ausente." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, code: "invalid_url", error: "URL de destino malformada." };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      code: "insecure_scheme",
      error: "Apenas App Links HTTPS são aceitos.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      code: "userinfo_not_allowed",
      error: "Credenciais na URL não são permitidas.",
    };
  }

  if (parsed.port !== "") {
    return {
      valid: false,
      code: "port_not_allowed",
      error: "Portas customizadas não são permitidas em App Links.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOST_SET.has(host)) {
    return {
      valid: false,
      code: "host_not_allowed",
      error: `Host fora do contrato oficial: ${host}`,
    };
  }

  if (!isAllowedAppLinkPath(parsed.pathname)) {
    return {
      valid: false,
      code: "path_not_allowed",
      error: `Caminho fora do contrato de App Link: ${parsed.pathname}`,
    };
  }

  for (const key of parsed.searchParams.keys()) {
    if (BLOCKED_QUERY_PARAMS.has(key.toLowerCase())) {
      return {
        valid: false,
        code: "blocked_query_param",
        error: `Parâmetro de redirecionamento ou conta proibido: ${key}`,
      };
    }
  }

  return {
    valid: true,
    url: parsed,
    host,
    pathname: parsed.pathname,
  };
}

/**
 * Valida uma requisição completa de transporte de sessão Android (operação fechada + host + App Link HTTPS).
 */
export function validateAndroidSessionTransportRequest(
  input: unknown,
): AndroidSessionTransportValidationResult {
  const parsed = transportRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_payload",
      error: "Payload de transporte Android inválido.",
    };
  }

  const { operation, targetUrl, installationId, recipientVersion } = parsed.data;

  if (!ALLOWED_OPERATION_SET.has(operation)) {
    return {
      ok: false,
      code: "invalid_operation",
      error: `Operação fora do conjunto fechado: ${operation}`,
    };
  }

  if (!INSTALLATION_ID_REGEX.test(installationId)) {
    return {
      ok: false,
      code: "invalid_installation_id",
      error: "Identificador de instalação inválido.",
    };
  }

  const linkCheck = validateAndroidAppLinkHttps(targetUrl);
  if (!linkCheck.valid) {
    return {
      ok: false,
      code: linkCheck.code,
      error: linkCheck.error,
    };
  }

  return {
    ok: true,
    data: {
      operation: operation as AndroidSessionTransportOperation,
      url: linkCheck.url,
      host: linkCheck.host,
      pathname: linkCheck.pathname,
      installationId,
      recipientVersion: recipientVersion ?? 1,
    },
  };
}

/**
 * Constrói uma URL de App Link HTTPS validada estritamente pelo contrato.
 */
export function buildAndroidSessionTransportUrl(params: {
  host: (typeof ALLOWED_ANDROID_APP_LINK_HOSTS)[number];
  path: string;
  operation: AndroidSessionTransportOperation;
  installationId: string;
  recipientVersion?: number;
}): string {
  const candidate = `https://${params.host}${params.path.startsWith("/") ? params.path : `/${params.path}`}`;
  const validation = validateAndroidSessionTransportRequest({
    operation: params.operation,
    targetUrl: candidate,
    installationId: params.installationId,
    recipientVersion: params.recipientVersion,
  });

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return validation.data.url.href;
}
