/**
 * Catálogo Canônico e Registro Declarativo de Playbooks Educativos do Axir.
 *
 * Módulo puro: sem dependências de UI, React ou Supabase (AGENTS.md Regra 3).
 */

export interface PlaybookMetadata {
  readonly moduleKey: string;
  readonly title: string;
  readonly shortLabel: string;
}

export const PLAYBOOK_REGISTRY: Record<string, PlaybookMetadata> = {
  transactions: {
    moduleKey: "transactions",
    title: "Guia de Lançamentos & Gestão de Cartões",
    shortLabel: "Lançamentos",
  },
  business: {
    moduleKey: "business",
    title: "Guia do Empreendedor & Enquadramento",
    shortLabel: "Negócio",
  },
  family: {
    moduleKey: "family",
    title: "Guia do Modo Família & Divisão Justa",
    shortLabel: "Família",
  },
  trips: {
    moduleKey: "trips",
    title: "Guia do Modo Viagem & Rateio Leve",
    shortLabel: "Viagens",
  },
  investments: {
    moduleKey: "investments",
    title: "Guia de Investimentos & Aportes Inteligentes",
    shortLabel: "Investimentos",
  },
  debts: {
    moduleKey: "debts",
    title: "Guia de Contas & Quitação de Dívidas",
    shortLabel: "Dívidas",
  },
} as const;

/**
 * Avalia se um playbook específico deve ser exibido na interface.
 * Respeita tanto a chave mestre global quanto a lista de dispensas locais.
 */
export function isPlaybookVisible(
  moduleKey: string,
  showMaster: boolean,
  dismissedKeys: readonly string[] = [],
): boolean {
  if (!showMaster) return false;
  return !dismissedKeys.includes(moduleKey);
}

/**
 * Retorna texto formatado no singular ou plural informando quais guias estão ocultados.
 * Exemplo: "1 guia individual ocultado (Lançamentos)" ou "2 guias individuais ocultados (Lançamentos e Família)".
 */
export function getDismissedPlaybooksSummary(dismissedKeys: readonly string[]): string {
  if (!dismissedKeys || dismissedKeys.length === 0) return "";

  const labels = dismissedKeys
    .map((key) => PLAYBOOK_REGISTRY[key]?.shortLabel || key)
    .filter(Boolean);

  if (labels.length === 0) return "";

  if (labels.length === 1) {
    return `1 guia individual ocultado (${labels[0]})`;
  }

  if (labels.length === 2) {
    return `2 guias individuais ocultados (${labels[0]} e ${labels[1]})`;
  }

  const allExceptLast = labels.slice(0, -1).join(", ");
  const last = labels[labels.length - 1];
  return `${labels.length} guias individuais ocultados (${allExceptLast} e ${last})`;
}
