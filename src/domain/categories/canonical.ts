/**
 * Definições canônicas de categorias padrão do aplicativo (canonical.ts).
 */

export interface DefaultCategorySeed {
  name: string;
  type: "expense" | "income";
  icon: string;
  color: string;
  is_reserved?: boolean;
}

export const RESERVED_CHARGES_CATEGORY_NAME = "Tarifas e Encargos";

export const CANONICAL_DEFAULT_CATEGORIES: readonly DefaultCategorySeed[] = [
  // Despesas Essenciais (Necessidades 50%)
  { name: "Alimentação", type: "expense", icon: "alimentacao", color: "#DDA726" },
  { name: "Moradia", type: "expense", icon: "moradia", color: "#8B5CF6" },
  { name: "Transporte", type: "expense", icon: "transporte", color: "#3B82F6" },
  { name: "Saúde", type: "expense", icon: "saude", color: "#EF4444" },
  { name: "Educação", type: "expense", icon: "educacao", color: "#2A9D8F" },
  { name: "Manutenção do Lar", type: "expense", icon: "moradia", color: "#8B5CF6" },
  { name: "Animais de Estimação (Pets)", type: "expense", icon: "pets", color: "#EC4899" },
  { name: "Impostos e Tributos", type: "expense", icon: "impostos", color: "#EF4444" },
  // Despesas de Estilo de Vida (Desejos 30% / Radar de Assinaturas)
  { name: "Lazer", type: "expense", icon: "lazer", color: "#EC4899" },
  { name: "Compras", type: "expense", icon: "compras", color: "#06B6D4" },
  { name: "Assinaturas", type: "expense", icon: "assinaturas", color: "#6366F1" },
  // Despesas Financeiras e Encargos (Reservada de Sistema)
  { name: RESERVED_CHARGES_CATEGORY_NAME, type: "expense", icon: "taxas", color: "#64748B", is_reserved: true },
  // Receitas
  { name: "Salário", type: "income", icon: "salario", color: "#10B981" },
  { name: "Serviços e Renda Extra", type: "income", icon: "salario", color: "#10B981" },
  { name: "Investimentos", type: "income", icon: "investimentos", color: "#3B82F6" },
  { name: "Outras Rendas", type: "income", icon: "salario", color: "#8B5CF6" },
] as const;
