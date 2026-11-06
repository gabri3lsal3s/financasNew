/**
 * Motor Puro de Normalização e Agrupamento de Categorias Familiares.
 *
 * Em um ecossistema familiar colaborativo multi-contas, os membros possuem
 * suas próprias categorias e convenções de nomenclatura (ex: 'Mercado' vs 'Supermercado',
 * 'Conta de Luz' vs 'Energia Elétrica', 'Farmácia' vs 'Drogaria').
 *
 * Este motor fornece:
 *   1. Normalização resiliente e lematização de nomes de categorias;
 *   2. Resolução determinística para macro-clusters canônicos da casa;
 *   3. Similaridade léxica (coeficiente de Sørensen-Dice) para agrupamento dinâmico;
 *   4. Agrupamento de categorias de ambos os membros em clusters unificados;
 *   5. Agregação de despesas consolidadas da casa em fatias temáticas com rateio
 *      por pagador, percentuais e invariantes em centavos estritos.
 *
 * Módulo puro de domínio: zero imports de UI, React ou Supabase.
 */

import { normalizePercentagesTo100 } from "../reports/distribution";

export type HouseholdClusterId =
  | "moradia"
  | "alimentacao_mercado"
  | "alimentacao_fora"
  | "utilidades"
  | "transporte"
  | "saude"
  | "educacao"
  | "pets"
  | "lazer_viagem"
  | "assinaturas_servicos"
  | "cuidados_pessoais"
  | "outros";

export interface HouseholdClusterDefinition {
  id: HouseholdClusterId;
  label: string;
  description: string;
  icon: string;
  color: string;
  stems: readonly string[];
  icons: readonly string[];
}

/**
 * Catálogo Canônico de Macro-Clusters do Orçamento Familiar.
 * Padrão fintech acolhedor com ícones padronizados lucide-react (AGENTS.md §4.8).
 */
export const HOUSEHOLD_CLUSTERS: readonly HouseholdClusterDefinition[] = [
  {
    id: "moradia",
    label: "Moradia & Habitação",
    description: "Aluguel, condomínio, IPTU, reformas, manutenção e artigos para o lar",
    icon: "home",
    color: "#3b82f6",
    stems: [
      "moradia",
      "aluguel",
      "condominio",
      "cond",
      "iptu",
      "reforma",
      "manutencao",
      "moveis",
      "decoracao",
      "diarista",
      "faxina",
      "casa",
      "apartamento",
      "imovel",
      "eletricista",
      "encanador",
      "pintura",
      "chaveiro",
      "jardim",
    ],
    icons: ["home", "building", "paint-bucket", "wrench", "hammer"],
  },
  {
    id: "alimentacao_mercado",
    label: "Supermercado & Feira",
    description: "Supermercado, feiras, sacolão, hortifruti, açougue e compras da despensa",
    icon: "shopping-cart",
    color: "#10b981",
    stems: [
      "mercado",
      "supermercado",
      "hipermercado",
      "hortifruti",
      "sacolao",
      "feira",
      "acougue",
      "mercearia",
      "atacadista",
      "atacado",
      "assai",
      "carrefour",
      "pao de acucar",
      "compras",
      "despensa",
      "rancho",
      "quitanda",
    ],
    icons: ["shopping-cart", "shopping-bag", "apple", "carrot", "store"],
  },
  {
    id: "alimentacao_fora",
    label: "Restaurantes & Delivery",
    description: "Restaurantes, lanchonetes, bares, cafeterias, delivery e aplicativos de comida",
    icon: "utensils",
    color: "#f59e0b",
    stems: [
      "restaurante",
      "bar",
      "lanche",
      "delivery",
      "ifood",
      "cafeteria",
      "cafe",
      "almoco",
      "jantar",
      "refeicao",
      "pizza",
      "pizzaria",
      "hamburguer",
      "churrasco",
      "churrascaria",
      "sushi",
      "comida",
      "padaria",
      "sorveteria",
      "boteco",
      "fast food",
      "happy hour",
    ],
    icons: ["utensils", "coffee", "pizza", "wine", "beer"],
  },
  {
    id: "utilidades",
    label: "Contas & Utilidades",
    description: "Energia elétrica, água, saneamento, gás encanado/botijão, internet e telefonia",
    icon: "zap",
    color: "#eab308",
    stems: [
      "energia",
      "luz",
      "eletricidade",
      "enel",
      "cpfl",
      "cemig",
      "copel",
      "agua",
      "sabesp",
      "saneamento",
      "esgoto",
      "gas",
      "botijao",
      "ultragaz",
      "internet",
      "fibra",
      "wifi",
      "claro",
      "vivo",
      "tim",
      "telefone",
      "celular",
      "telefonia",
      "banda larga",
    ],
    icons: ["zap", "droplet", "flame", "wifi", "phone", "lightbulb"],
  },
  {
    id: "transporte",
    label: "Transporte & Mobilidade",
    description: "Combustível, aplicativos de mobilidade, estacionamento, pedágio, IPVA e seguro do carro",
    icon: "car",
    color: "#6366f1",
    stems: [
      "transporte",
      "combustivel",
      "gasolina",
      "etanol",
      "diesel",
      "abastecimento",
      "posto",
      "ipiranga",
      "shell",
      "uber",
      "99",
      "corrida",
      "taxi",
      "pedagio",
      "sem parar",
      "veloe",
      "ipva",
      "seguro auto",
      "mecanico",
      "oficina",
      "estacionamento",
      "revisao",
      "pneu",
      "onibus",
      "metro",
      "bilhete unico",
      "recarga bilhete",
      "carro",
      "veiculo",
      "moto",
    ],
    icons: ["car", "bus", "train", "fuel", "navigation", "bike"],
  },
  {
    id: "saude",
    label: "Saúde & Farmácia",
    description: "Farmácia, medicamentos, consultas médicas, odontologia, exames, psicologia e plano de saúde",
    icon: "heart-pulse",
    color: "#ef4444",
    stems: [
      "saude",
      "farmacia",
      "drogaria",
      "droga",
      "medicamento",
      "remedio",
      "plano de saude",
      "convenio",
      "consulta",
      "medico",
      "medica",
      "dentista",
      "odontologia",
      "odonto",
      "psicologo",
      "terapia",
      "exame",
      "hospital",
      "clinica",
      "laboratorio",
      "unimed",
      "amil",
      "bradesco saude",
      "sulamerica",
      "hapvida",
      "notredame",
      "oftalmologista",
      "oculos",
      "otica",
    ],
    icons: ["heart-pulse", "pill", "activity", "cross", "stethoscope", "first-aid"],
  },
  {
    id: "educacao",
    label: "Educação & Cursos",
    description: "Mensalidades escolares, creche, faculdade, cursos de idiomas e material didático",
    icon: "graduation-cap",
    color: "#8b5cf6",
    stems: [
      "educacao",
      "escola",
      "colegio",
      "faculdade",
      "universidade",
      "pos",
      "mba",
      "curso",
      "mensalidade escolar",
      "creche",
      "livros",
      "material escolar",
      "ingles",
      "idiomas",
      "treinamento",
      "apostila",
    ],
    icons: ["graduation-cap", "book-open", "book", "library"],
  },
  {
    id: "pets",
    label: "Pets & Animais",
    description: "Veterinário, ração, banho e tosa, medicamentos e cuidados com animais de estimação",
    icon: "paw-print",
    color: "#ec4899",
    stems: [
      "pet",
      "pets",
      "cachorro",
      "gato",
      "veterinario",
      "racao",
      "pet shop",
      "banho e tosa",
      "vacina pet",
      "medicamento pet",
      "cobasi",
      "petz",
      "animal",
    ],
    icons: ["paw-print", "dog", "cat"],
  },
  {
    id: "lazer_viagem",
    label: "Lazer & Viagens",
    description: "Viagens, passagens aéreas, hospedagem, passeios, cinema, shows e eventos",
    icon: "plane",
    color: "#06b6d4",
    stems: [
      "lazer",
      "viagem",
      "ferias",
      "hotel",
      "pousada",
      "airbnb",
      "passagem",
      "voo",
      "cinema",
      "show",
      "teatro",
      "passeio",
      "parque",
      "clube",
      "entretenimento",
      "ingresso",
      "praia",
      "turismo",
    ],
    icons: ["plane", "ticket", "palmtree", "film", "compass"],
  },
  {
    id: "assinaturas_servicos",
    label: "Assinaturas & Conectividade",
    description: "Serviços de streaming de vídeo/música, armazenamento em nuvem, inteligência artificial e softwares",
    icon: "tv",
    color: "#a855f7",
    stems: [
      "assinatura",
      "streaming",
      "netflix",
      "spotify",
      "amazon prime",
      "prime video",
      "youtube",
      "hbo",
      "max",
      "disney",
      "apple",
      "icloud",
      "chatgpt",
      "openai",
      "software",
      "saas",
      "nuvem",
      "globoplay",
      "deezer",
      "servico digital",
    ],
    icons: ["tv", "monitor", "music", "play", "cloud"],
  },
  {
    id: "cuidados_pessoais",
    label: "Cuidados Pessoais & Roupas",
    description: "Cabeleireiro, barbearia, cosméticos, estética, academia e vestuário da família",
    icon: "sparkles",
    color: "#14b8a6",
    stems: [
      "cuidados pessoais",
      "beleza",
      "salao",
      "cabeleireiro",
      "barbearia",
      "barba",
      "cabelo",
      "cosmeticos",
      "maquiagem",
      "perfume",
      "perfumaria",
      "estetica",
      "manicure",
      "academia",
      "personal",
      "gympass",
      "smart fit",
      "roupas",
      "vestuario",
      "calcados",
      "sapatos",
      "moda",
    ],
    icons: ["sparkles", "scissors", "dumbbell", "shirt"],
  },
  {
    id: "outros",
    label: "Outras Despesas da Casa",
    description: "Despesas diversas, imprevistos, tributos e encargos gerais da casa",
    icon: "tag",
    color: "#64748b",
    stems: [
      "outros",
      "outras",
      "diversos",
      "geral",
      "imprevisto",
      "taxa",
      "tarifa",
      "banco",
      "anuidade",
      "tributo",
      "darf",
      "contabilidade",
    ],
    icons: ["tag", "receipt", "more-horizontal", "help-circle"],
  },
];

export const HOUSEHOLD_CLUSTER_MAP: Record<HouseholdClusterId, HouseholdClusterDefinition> =
  HOUSEHOLD_CLUSTERS.reduce(
    (acc, cluster) => {
      acc[cluster.id] = cluster;
      return acc;
    },
    {} as Record<HouseholdClusterId, HouseholdClusterDefinition>,
  );

const STOP_WORDS = new Set([
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "pra",
  "pro",
  "com",
  "por",
  "um",
  "uma",
  "uns",
  "umas",
  "o",
  "a",
  "os",
  "as",
]);

/**
 * Normaliza o texto de uma categoria: minúsculas, remoção de diacríticos,
 * remoção de caracteres de pontuação e colapso de espaços em branco.
 */
export function normalizeCategoryText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lematização e remoção de plurais simples em português.
 */
function normalizeStemWord(word: string): string {
  if (word.length > 5) {
    if (word.endsWith("coes")) {
      return word.slice(0, -4) + "cao";
    }
    if (word.endsWith("s") && !word.endsWith("is") && !word.endsWith("ss")) {
      return word.slice(0, -1);
    }
  }
  return word;
}

/**
 * Divide o nome da categoria em tokens limpos e filtrados (sem stop words).
 */
export function tokenizeCategoryName(name: string): string[] {
  const normalized = normalizeCategoryText(name);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
    .map(normalizeStemWord);
}

/**
 * Calcula a similaridade entre duas strings usando o coeficiente de Sørensen-Dice
 * sobre bigramas de caracteres das strings normalizadas.
 * Retorna valor entre 0.0 (sem similaridade) e 1.0 (idênticas).
 */
export function calculateStringSimilarity(strA: string, strB: string): number {
  const a = normalizeCategoryText(strA).replace(/\s+/g, "");
  const b = normalizeCategoryText(strB).replace(/\s+/g, "");

  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;

  const getBigrams = (str: string): Map<string, number> => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersectionSize = 0;
  for (const [bigram, countA] of bigramsA.entries()) {
    const countB = bigramsB.get(bigram);
    if (countB !== undefined) {
      intersectionSize += Math.min(countA, countB);
    }
  }

  const totalBigrams = a.length - 1 + (b.length - 1);
  return (2.0 * intersectionSize) / totalBigrams;
}

/**
 * Infere o macro-cluster canônico para uma categoria informada com base
 * em seu nome e/ou ícone representativo.
 */
export function inferClusterForCategory(category: {
  name?: string | null;
  icon?: string | null;
}): HouseholdClusterDefinition {
  const rawName = category.name ?? "";
  const normName = normalizeCategoryText(rawName);
  const rawIcon = category.icon?.toLowerCase().trim() || "";
  const normIcon = rawIcon.replace(/[^a-z0-9-]/g, "");

  // Separa clusters específicos do cluster genérico 'outros'
  const specificClusters = HOUSEHOLD_CLUSTERS.filter((c) => c.id !== "outros");

  // 1. Correspondência por raízes lexicais nos nomes (clusters específicos prioritários)
  if (normName) {
    const tokens = tokenizeCategoryName(rawName);

    // Prioridade 1: termos compostos exatos em clusters específicos
    for (const cluster of specificClusters) {
      for (const stem of cluster.stems) {
        if (stem.includes(" ") && normName.includes(stem)) {
          return cluster;
        }
      }
    }

    // Prioridade 2: correspondência por tokens em clusters específicos
    for (const cluster of specificClusters) {
      for (const stem of cluster.stems) {
        const cleanStem = normalizeStemWord(normalizeCategoryText(stem));
        if (tokens.includes(cleanStem)) {
          return cluster;
        }
      }
    }

    // Prioridade 3: correspondência por substring se stem for expressivo (>= 4 caracteres)
    for (const cluster of specificClusters) {
      for (const stem of cluster.stems) {
        const cleanStem = normalizeStemWord(normalizeCategoryText(stem));
        if (cleanStem.length >= 4 && normName.includes(cleanStem)) {
          return cluster;
        }
      }
    }
  }

  // 2. Correspondência por ícone do Design System (específico com casamento exato do slug)
  if (normIcon) {
    for (const cluster of specificClusters) {
      if (cluster.icons.some((ic) => ic === normIcon || normIcon === `lucide-${ic}`)) {
        return cluster;
      }
    }
  }

  // 3. Correspondência com termos genéricos do cluster 'outros' (ex.: "imprevistos", "tarifas")
  if (normName) {
    const tokens = tokenizeCategoryName(rawName);
    const outrosCluster = HOUSEHOLD_CLUSTER_MAP.outros;
    for (const stem of outrosCluster.stems) {
      const cleanStem = normalizeStemWord(normalizeCategoryText(stem));
      if (tokens.includes(cleanStem) || (cleanStem.length >= 4 && normName.includes(cleanStem))) {
        return outrosCluster;
      }
    }
  }

  // 4. Fallback canônico
  return HOUSEHOLD_CLUSTER_MAP.outros;
}

/**
 * Deriva uma chave representativa do cluster para uma dada categoria.
 */
export function deriveCategoryClusterKey(name: string, icon?: string | null): string {
  const cluster = inferClusterForCategory({ name, icon });
  return cluster.id;
}

export interface CategoryClusterInput {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface CategoryCluster<T = CategoryClusterInput> {
  clusterId: HouseholdClusterId | string;
  label: string;
  icon: string;
  color: string;
  categories: T[];
  categoryIds: string[];
}

/**
 * Agrupa uma coleção arbitrária de categorias de usuários nos macro-clusters da casa.
 * Mantém a ordem determinística do catálogo `HOUSEHOLD_CLUSTERS`.
 */
export function clusterCategories<T extends CategoryClusterInput>(
  categories: readonly T[],
): CategoryCluster<T>[] {
  if (!categories || categories.length === 0) return [];

  const groups = new Map<string, { definition: HouseholdClusterDefinition; items: T[] }>();

  for (const cat of categories) {
    const clusterDef = inferClusterForCategory(cat);
    const existing = groups.get(clusterDef.id);
    if (existing) {
      existing.items.push(cat);
    } else {
      groups.set(clusterDef.id, {
        definition: clusterDef,
        items: [cat],
      });
    }
  }

  const result: CategoryCluster<T>[] = [];

  // 1. Adiciona clusters na ordem canônica do catálogo
  for (const def of HOUSEHOLD_CLUSTERS) {
    const found = groups.get(def.id);
    if (found && found.items.length > 0) {
      result.push({
        clusterId: def.id,
        label: def.label,
        icon: def.icon,
        color: def.color,
        categories: found.items,
        categoryIds: found.items.map((i) => i.id),
      });
      groups.delete(def.id);
    }
  }

  // 2. Clusters dinâmicos/customizados remanescentes (se houver)
  for (const [id, entry] of groups.entries()) {
    result.push({
      clusterId: id,
      label: entry.definition.label,
      icon: entry.definition.icon,
      color: entry.definition.color,
      categories: entry.items,
      categoryIds: entry.items.map((i) => i.id),
    });
  }

  return result;
}

export interface ClusteredExpenseInput {
  amount_cents: number;
  category_name: string;
  category_icon?: string | null;
  category_color?: string | null;
  category_id?: string;
  user_id?: string;
  payer_name?: string;
  is_own?: boolean;
}

export interface MemberClusterContribution {
  user_id: string;
  payer_name: string;
  spent_cents: number;
  percentage: number;
}

export interface ClusteredExpenseGroup<T = ClusteredExpenseInput> {
  clusterId: HouseholdClusterId | string;
  label: string;
  icon: string;
  color: string;
  total_cents: number;
  percentage: number;
  display_percentage: string;
  expenses_count: number;
  expenses: T[];
  category_names: string[];
  member_contributions: MemberClusterContribution[];
}

/**
 * Agrupa despesas familiares consolidadas por macro-cluster temático da casa,
 * totalizando o desembolso em centavos inteiros e calculando a contribuição
 * exata de cada membro participante.
 *
 * @param expenses Coleção de despesas familiares (ex.: `FamilyConsolidationExpense[]`).
 * @returns Lista ordenada decrescentemente por total gasto (`total_cents`).
 */
export function clusterFamilyExpenses<T extends ClusteredExpenseInput>(
  expenses: readonly T[],
): ClusteredExpenseGroup<T>[] {
  if (!expenses || expenses.length === 0) return [];

  interface MutableClusterAccumulator {
    definition: HouseholdClusterDefinition;
    total_cents: number;
    expenses: T[];
    category_names: Set<string>;
    member_map: Map<string, { user_id: string; payer_name: string; spent_cents: number }>;
  }

  const clustersMap = new Map<string, MutableClusterAccumulator>();
  let totalHouseCents = 0;

  for (const exp of expenses) {
    const amount = Number.isFinite(exp.amount_cents) ? Math.max(0, Math.round(exp.amount_cents)) : 0;
    totalHouseCents += amount;

    const clusterDef = inferClusterForCategory({
      name: exp.category_name,
      icon: exp.category_icon,
    });

    let cluster = clustersMap.get(clusterDef.id);
    if (!cluster) {
      cluster = {
        definition: clusterDef,
        total_cents: 0,
        expenses: [],
        category_names: new Set(),
        member_map: new Map(),
      };
      clustersMap.set(clusterDef.id, cluster);
    }

    cluster.total_cents += amount;
    cluster.expenses.push(exp);
    if (exp.category_name) {
      cluster.category_names.add(exp.category_name.trim());
    }

    const memberKey = exp.user_id || exp.payer_name || "desconhecido";
    const existingMember = cluster.member_map.get(memberKey);
    if (existingMember) {
      existingMember.spent_cents += amount;
    } else {
      cluster.member_map.set(memberKey, {
        user_id: exp.user_id || memberKey,
        payer_name: exp.payer_name || (exp.is_own ? "Você" : "Parceiro"),
        spent_cents: amount,
      });
    }
  }

  const rawGroups: ClusteredExpenseGroup<T>[] = [];

  for (const cluster of clustersMap.values()) {
    const clusterPercentage =
      totalHouseCents > 0 ? (cluster.total_cents / totalHouseCents) * 100 : 0;

    const memberContributions: MemberClusterContribution[] = [];
    for (const member of cluster.member_map.values()) {
      const memberPct =
        cluster.total_cents > 0 ? (member.spent_cents / cluster.total_cents) * 100 : 0;

      memberContributions.push({
        user_id: member.user_id,
        payer_name: member.payer_name,
        spent_cents: member.spent_cents,
        percentage: Number(memberPct.toFixed(1)),
      });
    }

    // Ordena membros pelo maior pagador
    memberContributions.sort((a, b) => b.spent_cents - a.spent_cents);

    rawGroups.push({
      clusterId: cluster.definition.id,
      label: cluster.definition.label,
      icon: cluster.definition.icon,
      color: cluster.definition.color,
      total_cents: cluster.total_cents,
      percentage: clusterPercentage,
      display_percentage: `${clusterPercentage.toFixed(1).replace(".", ",")}%`,
      expenses_count: cluster.expenses.length,
      expenses: cluster.expenses,
      category_names: Array.from(cluster.category_names).sort(),
      member_contributions: memberContributions,
    });
  }

  // Ordena por maior gasto total da casa
  rawGroups.sort((a, b) => b.total_cents - a.total_cents);

  return normalizeClusterPercentages(rawGroups);
}

/**
 * Normaliza os percentuais dos clusters consolidados utilizando o Algoritmo do Maior Resto
 * (Hamilton-Hare), assegurando que a soma feche estritamente em 100,0%.
 */
export function normalizeClusterPercentages<T extends ClusteredExpenseInput>(
  clusters: readonly ClusteredExpenseGroup<T>[],
): ClusteredExpenseGroup<T>[] {
  if (clusters.length === 0) return [];

  const rawPercentageItems = clusters.map((c) => ({
    rawPct: c.percentage,
    originalCluster: c,
  }));

  const normalized = normalizePercentagesTo100(rawPercentageItems, 1);

  return normalized.map((norm) => ({
    ...norm.originalCluster,
    percentage: norm.formattedPct,
    display_percentage: norm.displayPctStr,
  }));
}
