/**
 * Motor puro de inferência determinística de categorias por palavras-chave (Fase 12 — Tarefa 28).
 * Mapeia termos frequentes de estabelecimentos brasileiros para identificadores canônicos.
 * Função pura do domínio: sem dependências de UI, React ou banco de dados.
 */

export type CanonicalCategorySlug =
  | "alimentacao"
  | "mercado"
  | "transporte"
  | "saude"
  | "lazer"
  | "assinaturas"
  | "compras"
  | "salario"
  | "investimentos"
  | "moradia"
  | "educacao";

interface KeywordGroup {
  slug: CanonicalCategorySlug;
  terms: string[];
}

/**
 * Remove acentuação, pontuação e múltiplos espaços para comparação determinística.
 */
export function normalizeInferenceText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tabela de correspondência ordenada por especificidade semântica.
 * Termos mais específicos (ex.: supermercado, drogaria, streaming) têm precedência.
 */
const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    slug: "mercado",
    terms: [
      "supermercado",
      "hipermercado",
      "mercadinho",
      "mercado",
      "hortifruti",
      "sacolao",
      "carrefour",
      "pao de acucar",
      "extra supermercado",
      "assai",
      "atacadao",
      "sams club",
      "atacadista",
      "emporio",
      "mercearia",
      "super pague menos",
      "super nos",
      "dia brasil",
      "zona sul",
      "mundial",
      "guanabara",
      "savegnago",
      "festval",
      "angeloni",
      "zaffari",
      "condor",
      "muffato",
    ],
  },
  {
    slug: "assinaturas",
    terms: [
      "netflix",
      "spotify",
      "amazon prime",
      "prime video",
      "disney plus",
      "disney",
      "youtube premium",
      "deezer",
      "apple com bill",
      "globoplay",
      "globo play",
      "hbo max",
      "max com",
      "chatgpt",
      "openai",
      "star plus",
      "paramount",
      "crunchyroll",
      "kindle",
      "globo comunicacao",
    ],
  },
  {
    slug: "saude",
    terms: [
      "drogasil",
      "droga raia",
      "raia drogasil",
      "pacheco",
      "drogaria",
      "farmacia",
      "pague menos",
      "panvel",
      "araujo",
      "sao paulo farmacia",
      "hospital",
      "clinica",
      "laboratorio",
      "fleury",
      "dasa",
      "lavoisier",
      "hermes pardini",
      "consulta medica",
      "medico",
      "dentista",
      "odontologia",
      "exame",
      "laboratorios",
      "unimed",
      "amil",
      "bradesco saude",
      "sulamerica saude",
    ],
  },
  {
    slug: "alimentacao",
    terms: [
      "restaurante",
      "lanchonete",
      "padaria",
      "panificadora",
      "pizzaria",
      "pizza",
      "churrascaria",
      "hamburgueria",
      "burger",
      "mcdonald",
      "habib",
      "ifood",
      "sushi",
      "doceria",
      "confeitaria",
      "cafeteria",
      "cafe",
      "bistro",
      "choperia",
      "bar",
      "gelateria",
      "sorveteria",
      "subway",
      "starbucks",
      "outback",
      "madero",
      "giraffas",
      "bobs",
      "spoleto",
      "cacau show",
      "kopenhagen",
    ],
  },
  {
    slug: "transporte",
    terms: [
      "uber",
      "99app",
      "99pop",
      "99 motorista",
      "posto",
      "shell",
      "ipiranga",
      "combustivel",
      "gasolina",
      "etanol",
      "diesel",
      "estacionamento",
      "estapar",
      "pedagio",
      "sem parar",
      "conectcar",
      "veloe",
      "passagem",
      "metro",
      "onibus",
      "tarifa transporte",
      "autopista",
      "ccr",
      "ecovias",
      "br distribuidora",
      "vibra energia",
    ],
  },
  {
    slug: "lazer",
    terms: [
      "cinema",
      "cinemark",
      "kinoplex",
      "uci cinema",
      "ingresso com",
      "show",
      "teatro",
      "parque",
      "resort",
      "hotel",
      "pousada",
      "airbnb",
      "booking",
      "decolar",
      "clube",
      "viagem",
      "eventim",
      "sympla",
      "ticket360",
      "blueticket",
      "steam",
      "playstation",
      "xbox",
      "nintendo",
    ],
  },
  {
    slug: "compras",
    terms: [
      "amazon br",
      "amazon brasil",
      "amazon",
      "amzn br",
      "amzn",
      "mercadolivre br",
      "mercadolivre",
      "mercado livre br",
      "mercado livre",
      "shopee brasil",
      "shopee br",
      "shopee",
      "shein",
      "magalu",
      "magazine luiza",
      "americanas",
      "casas bahia",
      "ponto frio",
      "fast shop",
      "kabum",
      "zara",
      "renner",
      "riachuelo",
      "c&a",
      "cea",
      "centauro",
      "kalunga",
      "leroy merlin",
      "aliexpress",
      "aliexpress com",
      "decathlon",
    ],
  },
  {
    slug: "salario",
    terms: [
      "salario",
      "folha de pagamento",
      "remuneracao",
      "adiantamento salarial",
      "plr",
      "pro labore",
      "vencimentos",
      "deposito salario",
      "pagamento empresa",
      "credito salario",
    ],
  },
  {
    slug: "investimentos",
    terms: [
      "investimento",
      "investimentos",
      "aporte",
      "aplicacao",
      "proventos",
      "dividendos",
      "jcp",
      "tesouro direto",
      "renda fixa",
      "cdb",
      "cripto",
      "bitcoin",
      "ethereum",
      "binance",
      "corretagem",
      "fundo de investimento",
      "titulos publicos",
    ],
  },
  {
    slug: "moradia",
    terms: [
      "enel",
      "sabesp",
      "copasa",
      "sanepar",
      "cemig",
      "cpfl",
      "light servicos",
      "comgas",
      "equatorial",
      "neoenergia",
      "aluguel",
      "condominio",
      "iptu",
      "energia eletrica",
      "saneamento",
    ],
  },
  {
    slug: "educacao",
    terms: [
      "escola",
      "colegio",
      "faculdade",
      "universidade",
      "mensalidade escolar",
      "curso",
      "pos graduacao",
      "udemy",
      "alura",
      "coursera",
    ],
  },
];

const FLATTENED_KEYWORDS: Array<{ term: string; slug: CanonicalCategorySlug }> = KEYWORD_GROUPS.flatMap(
  (group) => group.terms.map((term) => ({ term, slug: group.slug })),
).sort((a, b) => b.term.length - a.term.length);

/**
 * Infere o slug canônico de categoria a partir de uma descrição ou nome de estabelecimento.
 * Retorna o slug correspondente ou undefined quando não houver correspondência inequívoca.
 */
export function inferCategoryKeyword(description: string): CanonicalCategorySlug | undefined {
  if (!description) return undefined;
  const normalized = normalizeInferenceText(description);
  if (!normalized) return undefined;

  for (const item of FLATTENED_KEYWORDS) {
    if (normalized.includes(item.term)) {
      return item.slug;
    }
  }

  return undefined;
}

/**
 * Mapeia um slug canônico para a categoria real correspondente do usuário.
 * Prioriza match exato por ícone (`cat.icon === slug`), seguido de correspondência por nome.
 */
export function matchCategoryBySlug<T extends { id: string; name: string; icon?: string | null }>(
  categories: T[],
  slug: CanonicalCategorySlug,
): T | undefined {
  if (!categories || categories.length === 0) return undefined;

  // 1. Busca prioritária por ícone canônico configurado no schema
  const byIcon = categories.find((c) => c.icon === slug);
  if (byIcon) return byIcon;

  // 2. Mapeamento de termos associados ao nome da categoria
  const slugNameMap: Record<CanonicalCategorySlug, string[]> = {
    mercado: ["mercado", "supermercado", "compras do mês", "alimentação"],
    alimentacao: ["alimentação", "alimentacao", "restaurante", "refeição", "refeicao"],
    transporte: ["transporte", "combustível", "combustivel", "veículo", "veiculo", "carro"],
    saude: ["saúde", "saude", "farmácia", "farmacia", "medicamentos"],
    lazer: ["lazer", "entretenimento", "diversão", "viagem"],
    assinaturas: ["assinaturas", "assinatura", "serviços", "servicos", "recorrentes"],
    compras: ["compras", "vestuário", "vestuario", "eletrônicos", "pessoal"],
    salario: ["salário", "salario", "remuneração", "remuneracao", "renda", "receita"],
    investimentos: [
      "investimentos",
      "investimento",
      "aplicações",
      "aplicacoes",
      "ações",
      "acoes",
      "bolsa",
      "cripto",
    ],
    moradia: [
      "moradia",
      "habitação",
      "habitacao",
      "aluguel",
      "condomínio",
      "condominio",
      "luz",
      "água",
      "agua",
      "energia",
      "gás",
      "gas",
      "iptu",
      "contas residenciais",
    ],
    educacao: [
      "educação",
      "educacao",
      "escola",
      "faculdade",
      "universidade",
      "curso",
      "estudos",
      "mensalidade",
    ],
  };

  const targetNames = slugNameMap[slug] || [];
  for (const target of targetNames) {
    const targetNorm = normalizeInferenceText(target);
    const matched = categories.find((c) => normalizeInferenceText(c.name).includes(targetNorm));
    if (matched) return matched;
  }

  return undefined;
}
