/**
 * Motor de Memória e Aprendizado do Assistente — ESPECIFICAÇÃO & F30.
 *
 * Funções puras para processamento, exibição e formatação de temas
 * em cooldown de descarte e decisões de micro-feedback memorizadas.
 */

import type { QualifiedDismissReason } from "./feedback";

export interface FormattedThemeKey {
  name: string;
  detail?: string;
}

/**
 * Converte uma chave estável de tema (themeKey) em informações amigáveis para o usuário.
 * Remove prefixos técnicos (dup:, missing_expense:, income:, savings:, etc.) e aplica capitalização.
 */
export function formatAdvisorThemeKey(themeKey: string): FormattedThemeKey {
  if (!themeKey) {
    return { name: "Desconhecido" };
  }

  const parts = themeKey.split(":");
  const prefix = parts.length > 1 ? parts[0] : "";
  const rawName = parts.length > 1 ? parts.slice(1).join(":") : themeKey;

  // Substitui hífens e underscores por espaços e capitaliza
  const readableName = rawName.replace(/[-_]+/g, " ").trim();
  const capitalizedName = readableName
    ? readableName.charAt(0).toUpperCase() + readableName.slice(1)
    : themeKey;

  switch (prefix) {
    case "dup":
      return { name: capitalizedName, detail: "Cobrança duplicada" };
    case "missing_expense":
      return { name: capitalizedName, detail: "Despesa pendente" };
    case "income":
      return { name: capitalizedName, detail: "Renda habitual" };
    case "savings":
      return { name: capitalizedName, detail: "Oportunidade de corte" };
    case "price_adj":
      return { name: capitalizedName, detail: "Reajuste detectado" };
    case "due_today":
      return { name: capitalizedName, detail: "Vencimento do dia" };
    case "aporte":
      return { name: "Aporte mensal", detail: "Sugestão de aporte" };
    case "calib":
      return { name: capitalizedName, detail: "Calibração de recorrência" };
    default:
      return { name: capitalizedName };
  }
}

/**
 * Formata um timestamp de expiração de cooldown no padrão amigável DD/MM.
 */
export function formatCooldownExpiry(expiryMs: number): string {
  const date = new Date(expiryMs);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

/** Rótulos amigáveis para as decisões de micro-feedback memorizadas */
export const MEMORIZED_FEEDBACK_LABELS: Record<QualifiedDismissReason | "ignore" | "essential", string> = {
  already_cancelled: "Já cancelei",
  one_off: "É pontual",
  not_subscription: "Não é assinatura",
  ignore: "Ignorado",
  essential: "Considerado essencial",
};
