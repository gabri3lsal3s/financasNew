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
      "minuto pao de acucar",
      "extra supermercado",
      "extra mercado",
      "assai atacadista",
      "assai",
      "atacadao",
      "sams club",
      "atacadista",
      "emporio",
      "mercearia",
      "super pague menos",
      "super nos",
      "dia brasil",
      "supermercado dia",
      "zona sul",
      "mundial",
      "supermercados guanabara",
      "guanabara",
      "savegnago",
      "festval",
      "angeloni",
      "zaffari",
      "bourbon",
      "condor",
      "super muffato",
      "muffato",
      "supermercados bh",
      "supermercado bh",
      "roldao",
      "fort atacadista",
      "komprao",
      "spani atacadista",
      "tenda atacado",
      "akki atacado",
      "giga atacado",
      "makro",
      "nagumo",
      "sonda supermercados",
      "sonda",
      "coop",
      "verdemar",
      "bahamas",
      "prezunic",
      "natural da terra",
      "oba hortifruti",
    ],
  },
  {
    slug: "assinaturas",
    terms: [
      "netflix",
      "spotify",
      "amazon prime",
      "prime video",
      "primevideo",
      "disney plus",
      "disney",
      "youtube premium",
      "deezer",
      "apple com bill",
      "apple tv",
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
      "tidal",
      "mubi",
      "starz",
      "google cloud",
      "google storage",
      "google one",
      "icloud",
      "microsoft 365",
      "office 365",
      "dropbox",
      "github",
      "notion",
      "figma",
      "adobe",
      "canva",
      "hostgator",
      "aws",
      "smart fit",
      "smartfit",
      "bluefit",
      "bodytech",
      "bt bodytech",
      "selfit",
      "ironberg",
      "gympass",
      "wellhub",
      "totalpass",
    ],
  },
  {
    slug: "saude",
    terms: [
      "drogasil",
      "droga raia",
      "raia drogasil",
      "drogarias pacheco",
      "pacheco",
      "drogaria sao paulo",
      "sao paulo farmacia",
      "drogaria venancio",
      "drogaria araujo",
      "araujo",
      "drogaria catarinense",
      "farmacias nissei",
      "nissei",
      "extrafarma",
      "drogaria rosario",
      "farmacia de manipulacao",
      "pague menos",
      "farmacias pague menos",
      "panvel",
      "drogaria",
      "farmacia",
      "hospital",
      "clinica sim",
      "dr consulta",
      "clinica",
      "delboni auriemo",
      "delboni",
      "alta diagnosticos",
      "laboratorio sabin",
      "sabin",
      "a+ medicina",
      "laboratorio",
      "laboratorios",
      "fleury",
      "dasa",
      "lavoisier",
      "hermes pardini",
      "consulta medica",
      "medico",
      "dentista",
      "odontologia",
      "exame",
      "notredame intermedica",
      "intermedica",
      "hapvida",
      "porto saude",
      "porto seguro saude",
      "unimed",
      "amil",
      "bradesco saude",
      "sulamerica saude",
      "sulamerica",
      "odontoprev",
      "metlife",
      "bradesco dental",
      "otica",
      "oticas",
      "oticas carol",
      "chilli beans",
      "grandvision",
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
      "burger king",
      "bk brasil",
      "burger",
      "mcdonalds",
      "mc donalds",
      "mcdonald",
      "habibs",
      "habib",
      "ragazzo",
      "pizza hut",
      "dominos pizza",
      "dominos",
      "kfc",
      "popeyes",
      "ifood",
      "ze delivery",
      "rappi",
      "sushi",
      "doceria",
      "confeitaria",
      "cafeteria",
      "cafe",
      "casa do pao de queijo",
      "havanna",
      "frans cafe",
      "rei do mate",
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
      "acougue",
      "boutique de carnes",
      "swift",
      "casa de carnes",
      "peixaria",
      "rotisseria",
      "cantina",
      "galeteria",
      "buffet",
    ],
  },
  {
    slug: "transporte",
    terms: [
      "uber",
      "99app",
      "99pop",
      "99 motorista",
      "indrive",
      "cabify",
      "blablacar",
      "posto ipiranga",
      "ipiranga",
      "posto shell",
      "shell",
      "posto petrobras",
      "posto br",
      "petrobras",
      "vibra energia",
      "br distribuidora",
      "postos ale",
      "ale combustiveis",
      "dislub",
      "auto posto",
      "abastece ai",
      "shell box",
      "posto",
      "combustivel",
      "gasolina",
      "etanol",
      "diesel",
      "estacionamento",
      "estapar",
      "indigo estacionamento",
      "parebem",
      "multipark",
      "estacionamento rotativo",
      "zona azul",
      "pedagio",
      "sem parar",
      "conectcar",
      "veloe",
      "move mais",
      "taggy",
      "passagem",
      "metro",
      "onibus",
      "tarifa transporte",
      "bilhete unico",
      "top transporte",
      "riocard",
      "autopista",
      "ccr",
      "ecovias",
      "autoban",
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
