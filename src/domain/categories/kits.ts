/**
 * Catálogo Canônico de Kits de Categorias (kits.ts).
 *
 * Fornece presets temáticos inteligentes para o fluxo de caixa do aplicativo:
 *   • Kit Essencial / Dia a Dia (Preset canônico e prateleira de recuperação de categorias excluídas);
 *   • Kit Negócio & PJ (MEI, autônomos, consultores, prestadores e microempresas);
 *   • Kit Família & Residência (Gastos compartilhados, lar, casal e dependentes);
 *   • Kit Veículos & Mobilidade (Combustível, manutenção automotiva e tributos veiculares).
 *
 * Regras estritas:
 *   - Zero emojis em títulos, descrições e nomes de categorias (AGENTS.md Regra 8).
 *   - Ícones de itens devem ser compatíveis com CATEGORY_ICON_MAP.
 *   - Funções puras sem dependências de UI ou Supabase.
 */

export interface CategoryKitItem {
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
  description?: string;
  scope?: "personal" | "business";
  is_family?: boolean;
}

export type CategoryKitId = "essential" | "business" | "family" | "vehicle";

export interface CategoryKit {
  id: CategoryKitId;
  title: string;
  description: string;
  iconName: "sparkles" | "briefcase" | "family" | "car";
  badge?: string;
  items: readonly CategoryKitItem[];
}

/** Kit 1: Essencial / Dia a Dia (Categorias oficiais canônicas de uso individual). */
export const CATEGORY_KIT_ESSENTIAL: CategoryKit = {
  id: "essential",
  title: "Essencial & Dia a Dia",
  description:
    "Categorias oficiais de base do aplicativo. Caso tenha excluído alguma categoria padrão, recupere-a aqui pontualmente.",
  iconName: "sparkles",
  badge: "Padrão",
  items: [
    // Despesas de Consumo e Necessidades
    { name: "Alimentação", type: "expense", icon: "alimentacao", color: "#DDA726" },
    { name: "Moradia", type: "expense", icon: "moradia", color: "#8B5CF6" },
    { name: "Transporte", type: "expense", icon: "transporte", color: "#3B82F6" },
    { name: "Saúde", type: "expense", icon: "saude", color: "#EF4444" },
    { name: "Educação", type: "expense", icon: "educacao", color: "#2A9D8F" },
    { name: "Manutenção do Lar", type: "expense", icon: "moradia", color: "#8B5CF6" },
    { name: "Animais de Estimação (Pets)", type: "expense", icon: "pets", color: "#EC4899" },
    { name: "Impostos e Tributos", type: "expense", icon: "impostos", color: "#EF4444" },
    // Estilo de Vida e Assinaturas
    { name: "Lazer", type: "expense", icon: "lazer", color: "#EC4899" },
    { name: "Compras", type: "expense", icon: "compras", color: "#06B6D4" },
    { name: "Assinaturas", type: "expense", icon: "assinaturas", color: "#6366F1" },
    // Receitas
    { name: "Salário", type: "income", icon: "salario", color: "#10B981" },
    { name: "Serviços e Renda Extra", type: "income", icon: "salario", color: "#10B981" },
    { name: "Investimentos", type: "income", icon: "investimentos", color: "#3B82F6" },
    { name: "Outras Rendas", type: "income", icon: "salario", color: "#8B5CF6" },
  ],
};

/** Kit 2: Profissional (MEI, autônomos, consultores, prestadores e microempresas). */
export const CATEGORY_KIT_BUSINESS: CategoryKit = {
  id: "business",
  title: "Profissional",
  description:
    "Plano de contas profissional para separar custos operacionais do trabalho ou empresa, viabilizando o DRE e o Termômetro do DAS-MEI.",
  iconName: "briefcase",
  badge: "Modo Profissional",
  items: [
    {
      name: "Prestação de Serviços",
      type: "income",
      icon: "salario",
      color: "#10B981",
      scope: "business",
      description: "Faturamento de honorários, consultorias, atendimentos e horas técnicas.",
    },
    {
      name: "Vendas de Produtos",
      type: "income",
      icon: "compras",
      color: "#059669",
      scope: "business",
      description: "Comércio, revenda de mercadorias, cursos ou infoprodutos.",
    },
    {
      name: "Impostos e Guia DAS",
      type: "expense",
      icon: "impostos",
      color: "#EF4444",
      scope: "business",
      description: "Guia DAS-MEI, Simples Nacional, ISS e tributos corporativos.",
    },
    {
      name: "Ferramentas e Softwares",
      type: "expense",
      icon: "assinaturas",
      color: "#6366F1",
      scope: "business",
      description: "Assinaturas de software, hospedagem, CRM, domínio e licenças.",
    },
    {
      name: "Custos Operacionais e Escritório",
      type: "expense",
      icon: "moradia",
      color: "#64748B",
      scope: "business",
      description: "Aluguel comercial, coworking, telefone corporativo e infraestrutura.",
    },
    {
      name: "Fornecedores e Insumos",
      type: "expense",
      icon: "mercado",
      color: "#D97706",
      scope: "business",
      description: "Matéria-prima, estoque de mercadorias e materiais de trabalho.",
    },
    {
      name: "Serviços Terceirizados e Contabilidade",
      type: "expense",
      icon: "justica",
      color: "#8B5CF6",
      scope: "business",
      description: "Contador, assessoria jurídica, certificação digital e freelancers.",
    },
  ],
};

/** Kit 3: Família & Residência (Gestão de contas da casa, casal e dependentes). */
export const CATEGORY_KIT_FAMILY: CategoryKit = {
  id: "family",
  title: "Família & Residência",
  description:
    "Estrutura para despesas compartilhadas do domicílio, abastecimento doméstico e acerto de contas justo entre membros.",
  iconName: "family",
  badge: "Modo Família",
  items: [
    {
      name: "Dependentes e Filhos",
      type: "expense",
      icon: "educacao",
      color: "#F59E0B",
      is_family: true,
      description: "Vestuário infantil, creche, materiais escolares, pediatra e lazer infantil.",
    },
    {
      name: "Mercado e Feira da Casa",
      type: "expense",
      icon: "mercado",
      color: "#DDA726",
      is_family: true,
      description: "Abastecimento da despensa e compras de mantimentos para o domicílio.",
    },
    {
      name: "Cuidados e Limpeza Doméstica",
      type: "expense",
      icon: "moradia",
      color: "#8B5CF6",
      is_family: true,
      description: "Faxina, diarista, reparos da casa, produtos de limpeza e manutenção do lar.",
    },
    {
      name: "Animais de Estimação (Pets)",
      type: "expense",
      icon: "pets",
      color: "#EC4899",
      is_family: true,
      description: "Ração, veterinário, vacinas, banho e tosa dos animais da casa.",
    },
    {
      name: "Saúde e Farmácia Familiar",
      type: "expense",
      icon: "saude",
      color: "#EF4444",
      is_family: true,
      description: "Medicamentos de uso contínuo da família, consultas e exames do casal.",
    },
    {
      name: "Pensão e Contribuições Familiares",
      type: "income",
      icon: "salario",
      color: "#3B82F6",
      is_family: true,
      description: "Pensão alimentícia, ajuda de custo ou reembolso de gastos domiciliares.",
    },
    {
      name: "Aluguéis e Rendimentos da Casa",
      type: "income",
      icon: "moradia",
      color: "#10B981",
      is_family: true,
      description: "Aluguel de imóvel da família ou sublocação de espaço compartilhado.",
    },
  ],
};

/** Kit 4: Veículos & Mobilidade (Combustível, manutenção automotiva e tributos). */
export const CATEGORY_KIT_VEHICLE: CategoryKit = {
  id: "vehicle",
  title: "Veículos & Mobilidade",
  description:
    "Discriminação detalhada dos custos com automóvel, revisões preventivas, abastecimento e tributos de transporte.",
  iconName: "car",
  badge: "Mobilidade",
  items: [
    {
      name: "Combustível",
      type: "expense",
      icon: "transporte",
      color: "#3B82F6",
      description: "Gasolina, etanol, diesel ou recarga de veículo elétrico.",
    },
    {
      name: "Manutenção e Revisões Veiculares",
      type: "expense",
      icon: "energia",
      color: "#D97706",
      description: "Troca de óleo, pneus, freios, funilaria e revisões de rotina.",
    },
    {
      name: "Seguro Automotivo",
      type: "expense",
      icon: "justica",
      color: "#6366F1",
      description: "Mensalidade ou anuidade da apólice de seguro do veículo.",
    },
    {
      name: "Estacionamento e Pedágio",
      type: "expense",
      icon: "taxas",
      color: "#64748B",
      description: "Tags de pedágio automático, garagens e rotativo urbano.",
    },
    {
      name: "IPVA e Licenciamento",
      type: "expense",
      icon: "impostos",
      color: "#EF4444",
      description: "Tributos anuais veiculares, DPVAT e taxas de trânsito.",
    },
  ],
};

/** Lista completa de kits de categorias disponíveis no sistema. */
export const ALL_CATEGORY_KITS: readonly CategoryKit[] = [
  CATEGORY_KIT_ESSENTIAL,
  CATEGORY_KIT_BUSINESS,
  CATEGORY_KIT_FAMILY,
  CATEGORY_KIT_VEHICLE,
] as const;

/**
 * Normaliza o par (nome, tipo) para comparação insensível a maiúsculas/minúsculas e espaços.
 */
export function normalizeCategoryKey(name: string, type: string): string {
  return `${name.trim().toLowerCase()}:${type.trim().toLowerCase()}`;
}

/**
 * Verifica se um item de kit já está instalado na conta do usuário.
 */
export function isKitItemInstalled(
  item: CategoryKitItem,
  existingCategories: readonly { name: string; type: string }[],
): boolean {
  const targetKey = normalizeCategoryKey(item.name, item.type);
  return existingCategories.some(
    (existing) => normalizeCategoryKey(existing.name, existing.type) === targetKey,
  );
}

/**
 * Retorna os itens de um kit que ainda NÃO foram instalados pelo usuário.
 */
export function getMissingKitItems(
  kit: CategoryKit,
  existingCategories: readonly { name: string; type: string }[],
): CategoryKitItem[] {
  return kit.items.filter((item) => !isKitItemInstalled(item, existingCategories));
}
