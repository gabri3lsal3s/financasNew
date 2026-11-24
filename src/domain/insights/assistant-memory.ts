/**
 * Motor de Memória e Aprendizado do Assistente — ESPECIFICAÇÃO & F30.
 *
 * Funções puras para processamento, exibição e formatação de temas
 * em cooldown de descarte e decisões de micro-feedback memorizadas.
 */

import type { QualifiedDismissReason } from "./feedback";
import type { InsightThemeFamily, PaydayPattern } from "./learning-graph";

export interface FormattedThemeKey {
  name: string;
  detail?: string;
}

export const INSIGHT_FAMILY_LABELS: Record<InsightThemeFamily, string> = {
  pace: "Ritmo de Gastos",
  cash_gap: "Fluxo de Caixa",
  surplus: "Aportes & Sobra",
  habit: "Hábitos & Microgastos",
  savings_cut: "Cortes & Oportunidades",
  price_adjustment: "Reajustes de Assinatura",
  calibration: "Calibração de Lançamentos",
  income_confirm: "Confirmação de Renda",
  missing_expense: "Contas Pendentes",
  annual_commitment: "Compromissos Anuais",
  celebration: "Celebrações & Conquistas",
  monthly_closing: "Fechamento Mensal",
};

export const PAYDAY_PATTERN_LABELS: Record<PaydayPattern, { title: string; description: string }> = {
  unknown: {
    title: "Em aprendizado",
    description: "Ainda coletando histórico de entradas para identificar seu ciclo habitual.",
  },
  start_of_month: {
    title: "Início do mês (dias 1–10)",
    description: "Suas entradas costumam concentrar-se nos primeiros 10 dias do mês.",
  },
  biweekly: {
    title: "Quinzenal (2 ciclos)",
    description: "Recebimento dividido em duas janelas principais ao longo do mês.",
  },
  late_month: {
    title: "Fim do mês (dias 20–31)",
    description: "Recebimento concentrado na última dezena do mês.",
  },
  variable_flow: {
    title: "Fluxo variável",
    description: "Entradas distribuídas em datas variadas ao longo do mês.",
  },
};

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
    case "calib_tx":
    case "tx_one_off":
      return { name: "Compra pontual isolada", detail: "Calibração de transação" };
    case "one_off":
      return { name: capitalizedName, detail: "Pontual no mês" };
    case "celebration":
      return { name: "Celebrações", detail: "Conquista financeira" };
    case "category":
      return { name: capitalizedName, detail: "Categoria essencial" };
    case "habit": {
      if (themeKey.includes("commute") || themeKey.includes("mobility")) {
        return { name: "Deslocamentos e transporte", detail: "Hábito frequente" };
      }
      if (themeKey.includes("daily_meals")) {
        return { name: "Refeições de rotina", detail: "Hábito frequente" };
      }
      if (themeKey.includes("delivery")) {
        return { name: "Entregas e delivery", detail: "Hábito frequente" };
      }
      if (themeKey.includes("coffee_snacks")) {
        return { name: "Cafés e pequenos lanches", detail: "Microvazamento" };
      }
      if (themeKey.includes("groceries")) {
        return { name: "Mercado e feira", detail: "Hábito frequente" };
      }
      return { name: capitalizedName, detail: "Hábito de consumo" };
    }
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
