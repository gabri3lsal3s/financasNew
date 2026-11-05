/**
 * Motor de Serialização e Compartilhamento via Stateful URLs (stateful-url.ts).
 *
 * Permite serializar e desserializar parâmetros de simulação financeira
 * em query strings comprimidas e URL-safe (?s=eyJw...).
 *
 * Motor 100% puro: sem dependências de UI, React ou Supabase (AGENTS.md seção 3).
 * Validação rigorosa via Zod nas bordas e proteção contra estouro de memória/payloads maliciosos.
 */

import { z } from "zod";

/** Limite de segurança de tamanho do payload codificado (64 KB). */
export const MAX_STATEFUL_PAYLOAD_LENGTH = 65536;

/** Parâmetro de query padrão para estado de simulação. */
export const DEFAULT_STATE_QUERY_PARAM = "s";

// =============================================================================
// ENCODING / DECODING BASE64URL SEGURO COM SUPORTE A UTF-8
// =============================================================================

/**
 * Converte string UTF-8 arbitrária para formato Base64URL (RFC 4648 §5).
 * Substitui '+' por '-', '/' por '_' e remove '=' de padding.
 */
export function stringToBase64Url(str: string): string {
  if (typeof TextEncoder !== "undefined") {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    const b64 = btoa(binary);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // Fallback para ambientes legados sem TextEncoder
  const b64 = btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16)),
    ),
  );
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Converte string Base64URL de volta para string UTF-8.
 * Retorna null caso a entrada seja inválida ou corrompida.
 */
export function base64UrlToString(base64Url: string): string | null {
  if (typeof base64Url !== "string" || !base64Url) return null;
  if (base64Url.length > MAX_STATEFUL_PAYLOAD_LENGTH) return null;

  try {
    let b64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) {
      b64 += "=";
    }

    const binary = atob(b64);
    if (typeof TextDecoder !== "undefined") {
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }

    return decodeURIComponent(
      Array.prototype.map
        .call(binary, (ch: string) => "%" + ("00" + ch.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch {
    return null;
  }
}

// =============================================================================
// SERIALIZAÇÃO / DESSERIALIZAÇÃO GENÉRICA DE ESTADOS
// =============================================================================

/**
 * Serializa qualquer objeto em uma string codificada em Base64URL.
 */
export function serializeStateToQueryParam<T>(state: T): string {
  const json = JSON.stringify(state);
  return stringToBase64Url(json);
}

/**
 * Desserializa uma string codificada em Base64URL em um objeto com validação opcional de Zod.
 * Retorna null se a string for inválida, corrompida ou falhar no schema.
 */
export function deserializeStateFromQueryParam<T>(
  paramValue: string | null | undefined,
  schema?: z.ZodType<T>,
): T | null {
  if (!paramValue || typeof paramValue !== "string") return null;

  const rawJson = base64UrlToString(paramValue.trim());
  if (!rawJson) return null;

  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (schema) {
      const validation = schema.safeParse(parsed);
      return validation.success ? validation.data : null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Constrói uma URL completa ou relativa contendo o estado serializado na query string.
 */
export function buildStatefulUrl(
  basePathOrUrl: string,
  state: unknown,
  paramName: string = DEFAULT_STATE_QUERY_PARAM,
): string {
  const serialized = serializeStateToQueryParam(state);

  // Divide URL em base e query string existente
  const [base, existingQuery] = basePathOrUrl.split("?");
  const searchParams = new URLSearchParams(existingQuery || "");
  searchParams.set(paramName, serialized);

  const query = searchParams.toString();
  return `${base}?${query}`;
}

/**
 * Extrai e desserializa o estado a partir de uma URL completa, rota relativa ou query string.
 */
export function parseStatefulUrl<T>(
  searchOrUrl: string,
  schema?: z.ZodType<T>,
  paramName: string = DEFAULT_STATE_QUERY_PARAM,
): T | null {
  if (!searchOrUrl || typeof searchOrUrl !== "string") return null;

  let query = searchOrUrl;
  const qIndex = searchOrUrl.indexOf("?");
  if (qIndex >= 0) {
    query = searchOrUrl.slice(qIndex);
  } else if (!searchOrUrl.includes("=") && !searchOrUrl.startsWith("?")) {
    // Se o valor fornecido for o próprio valor do parâmetro já extraído
    return deserializeStateFromQueryParam<T>(searchOrUrl, schema);
  }

  const searchParams = new URLSearchParams(query);
  const paramVal = searchParams.get(paramName);
  return deserializeStateFromQueryParam<T>(paramVal, schema);
}

// =============================================================================
// SCHEMAS E HELPERS ESPECÍFICOS PARA OS SIMULADORES ABERTOS
// =============================================================================

// 1. Simulador de Juros Compostos & FIRE (/ferramentas/juros-compostos)
export const compoundInterestShareSchema = z.object({
  initialAmountCents: z.number().int().nonnegative().max(1_000_000_000_000), // R$ 10 bi
  monthlyContributionCents: z.number().int().nonnegative().max(100_000_000_00), // R$ 100 mi
  annualRatePercent: z.number().min(0).max(1000),
  periodYears: z.number().int().min(1).max(100),
  monthlyLivingCostCents: z.number().int().nonnegative().max(100_000_000_00).optional(),
});

export type CompoundInterestShareState = z.infer<typeof compoundInterestShareSchema>;

export function encodeCompoundInterestState(state: CompoundInterestShareState): string {
  return serializeStateToQueryParam(state);
}

export function decodeCompoundInterestState(
  paramOrUrl: string | null | undefined,
): CompoundInterestShareState | null {
  if (!paramOrUrl) return null;
  return parseStatefulUrl(paramOrUrl, compoundInterestShareSchema);
}

// 2. Simulador de Dívidas: Avalanche vs Bola de Neve (/ferramentas/simulador-dividas)
export const debtItemShareSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(100),
  balanceCents: z.number().int().nonnegative().max(1_000_000_000_000),
  monthlyRatePercent: z.number().min(0).max(1000),
  minPaymentCents: z.number().int().nonnegative().max(1_000_000_000_000),
});

export const debtSimulatorShareSchema = z.object({
  debts: z.array(debtItemShareSchema).min(1).max(50),
  extraBudgetCents: z.number().int().nonnegative().max(1_000_000_000_000),
  strategy: z.enum(["avalanche", "snowball"]).optional(),
});

export type DebtSimulatorShareState = z.infer<typeof debtSimulatorShareSchema>;

export function encodeDebtSimulatorState(state: DebtSimulatorShareState): string {
  return serializeStateToQueryParam(state);
}

export function decodeDebtSimulatorState(
  paramOrUrl: string | null | undefined,
): DebtSimulatorShareState | null {
  if (!paramOrUrl) return null;
  return parseStatefulUrl(paramOrUrl, debtSimulatorShareSchema);
}

// 3. Simulador de Rebalanceamento Inteligente de Carteira (/ferramentas/rebalanceamento)
export const rebalanceClassShareSchema = z.object({
  key: z.string().max(64),
  name: z.string().max(100),
  targetPercent: z.number().min(0).max(100),
  currentProportion: z.number().min(0).max(1),
  yieldRate: z.number().min(0).max(100).default(0.06),
});

export const rebalanceSimulatorShareSchema = z.object({
  patrimonyBaseCents: z.number().int().nonnegative().max(1_000_000_000_000),
  aporteAmountCents: z.number().int().nonnegative().max(1_000_000_000_000),
  classes: z.array(rebalanceClassShareSchema).min(1).max(30),
  selectedPreset: z.string().max(64).optional(),
});

export type RebalanceSimulatorShareState = z.infer<typeof rebalanceSimulatorShareSchema>;

export function encodeRebalanceSimulatorState(state: RebalanceSimulatorShareState): string {
  return serializeStateToQueryParam(state);
}

export function decodeRebalanceSimulatorState(
  paramOrUrl: string | null | undefined,
): RebalanceSimulatorShareState | null {
  if (!paramOrUrl) return null;
  return parseStatefulUrl(paramOrUrl, rebalanceSimulatorShareSchema);
}
