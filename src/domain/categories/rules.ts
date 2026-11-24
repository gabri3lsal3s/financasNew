/**
 * Regras puras de sugestão inteligente de ícones, cores e limites para categorias (rules.ts).
 */

export interface CategoryRule {
  /** Nome do ícone (schema `categories.icon` — ver CATEGORY_ICON_MAP). */
  icon: string;
  /** Cor sugerida (hex). */
  color: string;
  /** % da renda sugerida como limite (0–100). */
  limitPercent: number;
}

/** Regras por palavra-chave do nome da categoria (moradia, alimentação, transporte…). */
export const CATEGORY_RULES: Record<string, CategoryRule> = {
  moradia: { icon: "moradia", color: "#8B5CF6", limitPercent: 30 },
  aluguel: { icon: "moradia", color: "#8B5CF6", limitPercent: 30 },
  casa: { icon: "moradia", color: "#8B5CF6", limitPercent: 30 },
  alimentacao: { icon: "alimentacao", color: "#DDA726", limitPercent: 15 },
  mercado: { icon: "mercado", color: "#DDA726", limitPercent: 15 },
  supermercado: { icon: "mercado", color: "#DDA726", limitPercent: 15 },
  restaurante: { icon: "alimentacao", color: "#DDA726", limitPercent: 10 },
  transporte: { icon: "transporte", color: "#3B82F6", limitPercent: 10 },
  combustivel: { icon: "transporte", color: "#3B82F6", limitPercent: 10 },
  saude: { icon: "saude", color: "#EF4444", limitPercent: 10 },
  farmacia: { icon: "saude", color: "#EF4444", limitPercent: 10 },
  medico: { icon: "saude", color: "#EF4444", limitPercent: 10 },
  educacao: { icon: "educacao", color: "#2A9D8F", limitPercent: 10 },
  curso: { icon: "educacao", color: "#2A9D8F", limitPercent: 10 },
  escola: { icon: "educacao", color: "#2A9D8F", limitPercent: 10 },
  faculdade: { icon: "educacao", color: "#2A9D8F", limitPercent: 10 },
  lazer: { icon: "lazer", color: "#EC4899", limitPercent: 5 },
  entretenimento: { icon: "lazer", color: "#EC4899", limitPercent: 5 },
  compras: { icon: "compras", color: "#06B6D4", limitPercent: 10 },
  vestuario: { icon: "vestuario", color: "#06B6D4", limitPercent: 10 },
  roupas: { icon: "vestuario", color: "#06B6D4", limitPercent: 10 },
  assinatura: { icon: "assinaturas", color: "#6366F1", limitPercent: 5 },
  assinaturas: { icon: "assinaturas", color: "#6366F1", limitPercent: 5 },
  telefone: { icon: "telefone", color: "#6366F1", limitPercent: 5 },
  internet: { icon: "internet", color: "#6366F1", limitPercent: 5 },
  energia: { icon: "energia", color: "#FACC15", limitPercent: 8 },
  agua: { icon: "agua", color: "#38BDF8", limitPercent: 5 },
  tarifa: { icon: "taxas", color: "#64748B", limitPercent: 5 },
  tarifas: { icon: "taxas", color: "#64748B", limitPercent: 5 },
  encargo: { icon: "taxas", color: "#64748B", limitPercent: 5 },
  encargos: { icon: "taxas", color: "#64748B", limitPercent: 5 },
  pets: { icon: "pets", color: "#EC4899", limitPercent: 5 },
  pet: { icon: "pets", color: "#EC4899", limitPercent: 5 },
  veterinario: { icon: "pets", color: "#EC4899", limitPercent: 5 },
  manutencao: { icon: "moradia", color: "#8B5CF6", limitPercent: 8 },
  impostos: { icon: "impostos", color: "#EF4444", limitPercent: 10 },
  imposto: { icon: "impostos", color: "#EF4444", limitPercent: 10 },
  tributos: { icon: "tributos", color: "#EF4444", limitPercent: 10 },
  tributo: { icon: "tributos", color: "#EF4444", limitPercent: 10 },
  servicos: { icon: "salario", color: "#10B981", limitPercent: 10 },
  servico: { icon: "salario", color: "#10B981", limitPercent: 10 },
};

/** Remove acentos ("Alimentação" → "alimentacao") para casar com as regras. */
export function normalizeCategoryKeyword(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Sugestão para o nome de uma categoria de despesa (ícone/cor/% da renda). */
export function suggestCategory(name: string): CategoryRule | null {
  const normalized = normalizeCategoryKeyword(name);
  if (!normalized) return null;
  for (const [keyword, rule] of Object.entries(CATEGORY_RULES)) {
    if (normalized.includes(keyword)) return rule;
  }
  return null;
}

/** Limite sugerido em centavos a partir da renda mensal (arredondado para baixo a R$ 10). */
export function suggestLimitCents(monthlyIncomeCents: number, limitPercent: number): number {
  if (monthlyIncomeCents <= 0 || limitPercent <= 0) return 0;
  const raw = Math.floor((monthlyIncomeCents * limitPercent) / 100);
  return Math.max(1000, Math.floor(raw / 1000) * 1000);
}
