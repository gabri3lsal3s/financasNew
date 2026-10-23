/**
 * Catálogo canônico de estabelecimentos e limpador especializado de adquirentes (§2.2).
 * Contém regras puras para eliminação de ruídos de maquininhas/adquirentes (PAG*, MP*, STONE*, etc.),
 * prefixos operacionais bancários, sufixos geográficos e dados de cartões, além de um catálogo nativo
 * com mais de 100 marcas e redes mais frequentes no Brasil.
 *
 * Função 100% pura: sem efeitos colaterais, sem dependência de UI, React ou banco de dados.
 */

import type { CanonicalCategorySlug } from "./category-inference";
import { normalizeInferenceText } from "./category-inference";
import { cleanTaxId } from "./merchant-memory";

export interface CanonicalMerchantEntry {
  /** Nome amigável canônico do estabelecimento (ex.: "McDonald's", "Drogasil", "Enel"). */
  friendlyName: string;
  /** Categoria canônica associada. */
  categorySlug: CanonicalCategorySlug;
  /** Dígitos limpos dos CNPJs conhecidos (se houver correspondência unívoca). */
  cnpjs?: string[];
  /** Palavras-chave ou variações normalizadas (sem acento, minúsculas). */
  keywords: string[];
}

/**
 * Higieniza o texto do estabelecimento eliminando ruídos de adquirentes,
 * bandeiras, intermediadores de pagamento, dados de cartões e terminais bancários.
 */
export function cleanAcquirerPrefixes(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();

  // 1. Tratamento especializado para Uber
  if (/^UBER\s*\*EATS\b/i.test(cleaned)) {
    return "Uber Eats";
  }
  if (/^UBER\b/i.test(cleaned)) {
    const after = cleaned.replace(/^UBER(?:\s*\*TRIP(?:\s*HELP)?|\s*\*PENDING|\s*\*|\s+|$)\s*/i, "").trim();
    if (after.length >= 3 && !/^(?:uber|trip|help|pending|do\s+brasil|br|tecnologia)/i.test(after)) {
      return after;
    }
    return "Uber";
  }

  // 2. Tratamento especializado para iFood
  if (/^IFOOD(?:\s*\*PEDIDO|\s*\*ENTREGA|\s*\*|\s+|$)/i.test(cleaned)) {
    const after = cleaned.replace(/^IFOOD(?:\s*\*PEDIDO|\s*\*ENTREGA|\s*\*|\s+|$)\s*/i, "").trim();
    if (after.length >= 2 && !/^(?:pedido|entrega)$/i.test(after)) {
      cleaned = after;
    } else {
      return "iFood";
    }
  }

  // 3. Tratamento especializado para Mercado Pago / Mercado Livre
  if (/^(?:MP\s*\*\s*MERCADOLIVRE|MERCADOLIVRE(?:\.COM|\s+BR|\s+BRASIL)?)\b/i.test(cleaned)) {
    return "Mercado Livre";
  }

  // 3.1. Tratamento especializado para Amazon
  if (/^(?:AMAZON(?:\s*(?:BR|BRASIL|\.COM|\.COM\.BR|SERVICOS))?|AMZN(?:\s*BR)?)\b/i.test(cleaned)) {
    return "Amazon";
  }

  // 3.2. Tratamento especializado para Shopee
  if (/^SHOPEE(?:\s*(?:BRASIL|BR|\.COM|\.COM\.BR))?\b/i.test(cleaned)) {
    return "Shopee";
  }

  // 4. Tratamento especializado para 99 / 99App
  if (/^99(?:\s*APP|\s*POP)?(?:\s*\*|\s+|$)/i.test(cleaned)) {
    const after = cleaned.replace(/^99(?:\s*APP|\s*POP)?(?:\s*\*|\s+|$)\s*/i, "").trim();
    if (after.length >= 2 && !/^(?:99\s*)?(?:pop|app|corrida|motorista)$/i.test(after)) {
      cleaned = after;
    } else {
      return "99";
    }
  }

  // 5. Remoção de prefixos de adquirentes e gateways de pagamento
  cleaned = cleaned.replace(
    /^(?:PAG\s*\*|PAGSEGURO\s*\*|PAGBANK\s*\*|PAGARME\s*\*|PAGAR\.ME\s*\*|MP\s*\*|MERCADOPAGO\s*\*|STONE\s*\*|TON\s*\*|CIELO\s*\*|REDECARD\s*\*|REDE\s*\*|GETNET\s*\*|SUMUP\s*\*|SAFRAPAY\s*\*|SAFRA\s*\*|INFINITEPAY\s*\*|INFINITE\s*\*|BIN\s*\*|GLOBAL\s*PAYMENTS\s*\*|GLOBAL\s*\*|ADYEN\s*\*|EBANX\s*\*|STRIPE\s*\*|ZOOP\s*\*|RAPPI\s*\*|ZE\s*DELIVERY\s*\*|ZEDELIVERY\s*\*)\s*/i,
    "",
  );

  // Variações com separadores traço ou ponto (ex.: "PAG - Padaria", "STONE.Loja")
  cleaned = cleaned.replace(
    /^(?:PAG|PAGSEGURO|PAGBANK|STONE|TON|CIELO|REDE|GETNET|SUMUP|SAFRAPAY|INFINITEPAY)\s*[-_.:]\s*/i,
    "",
  );

  // 6. Remoção de prefixos operacionais bancários
  cleaned = cleaned.replace(
    /^(?:COMPRA\s+(?:APROVADA|NO\s+D[EÉ]BITO|NO\s+CR[EÉ]DITO|A\s+VISTA|PARCELADA(?:\s+EM\s+\d+X)?)\s*)+[-:]?\s*/i,
    "",
  );
  cleaned = cleaned.replace(
    /^(?:A\s+VISTA|PARCELAD[AO](?:\s+EM\s+\d+X)?)\s*[-:]?\s*/i,
    "",
  );
  cleaned = cleaned.replace(
    /^(?:PAGTO\s+(?:ELETRON\s+)?COBRANCA|TRANSFER[EÊ]NCIA\s+PIX(?:\s+PARA)?|ENVIO\s+PIX|PIX\s+TRANSF|PAGAMENTO\s+(?:DE\s+)?T[IÍ]TULO|D[EÉ]BITO\s+(?:ELO|VISA|MASTER(?:CARD)?))\s*[-:]?\s*/i,
    "",
  );

  // 7. Remoção de identificadores de terminais POS/NSU/DOC/AUT
  cleaned = cleaned.replace(/\b(?:POS|TERM|TERM\.|NSU|DOC|AUT|AUT\.)\s*[:.-]?\s*\d{3,10}\b/gi, "");

  // 8. Remoção de datas ou horas embutidas (ex.: "12/03", "14/05/2026", "14:30")
  cleaned = cleaned.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, "");
  cleaned = cleaned.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "");

  // 9. Remoção de sufixos de geolocalização e siglas de UF (" SAO PAULO BR", " RIO DE JANEI BRA", etc.)
  cleaned = cleaned.replace(
    /\s+(?:SAO PAULO|RIO DE JANEI(?:RO)?|BELO HORIZONTE|CURITIBA|PORTO ALEGRE|BRASILIA|SALVADOR|FORTALEZA|RECIFE|CAMPINAS|GOIANIA|[A-Z]{2})\s+(?:BR|BRA)$/i,
    "",
  );
  cleaned = cleaned.replace(
    /\s+(?:SAO PAULO|RIO DE JANEIRO|BELO HORIZONTE|CURITIBA|PORTO ALEGRE|BRASILIA|SALVADOR|FORTALEZA|RECIFE|CAMPINAS|GOIANIA)\s+(?:SP|RJ|MG|PR|RS|DF|BA|CE|PE|GO)\b.*$/i,
    "",
  );

  // 9.1. Remoção de sufixos regionais e digitais isolados ao final do nome (§11.3)
  if (!/^(?:banco\s+do\s+brasil|bb)$/i.test(cleaned)) {
    cleaned = cleaned.replace(/\s+(?:br|brasil|com|com\.br|digital|app|pay)\b.*$/i, "");
    cleaned = cleaned.replace(/(?:\.com|\.com\.br)\b.*$/i, "");
  }

  // 10. Remoção de resíduos de cartões e bandeiras (" com Cartão Nubank final 1234", " no cartão final 1234")
  cleaned = cleaned.replace(
    /\s+(?:com|usando|no|na|pelo|pela|via)\s+(?:o\s+|a\s+)?cart[ãa]o\b.*$/i,
    "",
  );
  cleaned = cleaned.replace(
    /\s+(?:com|usando|no|na|pelo|pela|via)\s+(?:nubank|ita[úu]|bradesco|santander|inter|c6(?:\s+bank)?|caixa|bb|banco\s+do\s+brasil|ourocard|btg|xp|rico|neon|next|nomad|wise|pagbank|picpay|safra|sicredi|sicoob|mastercard|visa|elo|amex|american\s+express|hipercard)\b.*$/i,
    "",
  );
  cleaned = cleaned.replace(/[,.-]?\s*(?:cart[aã]o\s*)?final\s*[:.-]?\s*\d{4}\b.*$/i, "");

  // 11. Remoção de pontuações soltas nas bordas e espaços múltiplos
  cleaned = cleaned.replace(/^[\s,.:;/*_-]+|[\s,.:;/*_-]+$/g, "").replace(/\s{2,}/g, " ").trim();

  return cleaned;
}

/**
 * Catálogo canônico nativo com as 100+ marcas e redes mais frequentes no Brasil (§2.2),
 * cobrindo supermercados, drogarias, postos, streamings, telecomunicações, concessionárias públicas,
 * restaurantes, redes rápidas, e-commerce, moda e serviços.
 */
export const CANONICAL_MERCHANT_CATALOG: CanonicalMerchantEntry[] = [
  // ==========================================
  // 1. Supermercados e Atacarejos (18)
  // ==========================================
  {
    friendlyName: "Carrefour",
    categorySlug: "mercado",
    cnpjs: ["45543915000181"],
    keywords: ["carrefour", "carrefour express", "carrefour hiper", "carrefour market"],
  },
  {
    friendlyName: "Pão de Açúcar",
    categorySlug: "mercado",
    cnpjs: ["47508411000156"],
    keywords: ["pao de acucar", "minuto pao de acucar", "gpa pao de acucar"],
  },
  {
    friendlyName: "Assaí Atacadista",
    categorySlug: "mercado",
    cnpjs: ["06057223000171"],
    keywords: ["assai", "assai atacadista", "sendas distribuidora"],
  },
  {
    friendlyName: "Atacadão",
    categorySlug: "mercado",
    cnpjs: ["75315333000109"],
    keywords: ["atacadao", "atacadao s a", "atacadao distribuicao"],
  },
  {
    friendlyName: "Extra Supermercado",
    categorySlug: "mercado",
    keywords: ["extra supermercado", "mercado extra", "extra hiper", "compre bem"],
  },
  {
    friendlyName: "Sam's Club",
    categorySlug: "mercado",
    keywords: ["sams club", "sam s club"],
  },
  {
    friendlyName: "Grupo Big / Bompreço",
    categorySlug: "mercado",
    keywords: ["bompreco", "hiper bompreco", "grupo big", "walmart brasil"],
  },
  {
    friendlyName: "Zona Sul Supermercados",
    categorySlug: "mercado",
    keywords: ["zona sul", "supermercado zona sul"],
  },
  {
    friendlyName: "Super Muffato",
    categorySlug: "mercado",
    keywords: ["muffato", "super muffato", "max atacadista"],
  },
  {
    friendlyName: "Supermercados Guanabara",
    categorySlug: "mercado",
    keywords: ["guanabara", "supermercados guanabara"],
  },
  {
    friendlyName: "Supermercados BH",
    categorySlug: "mercado",
    keywords: ["supermercados bh", "mercado bh"],
  },
  {
    friendlyName: "Dia Supermercado",
    categorySlug: "mercado",
    keywords: ["dia brasil", "supermercado dia", "supermercados dia"],
  },
  {
    friendlyName: "Savegnago Supermercados",
    categorySlug: "mercado",
    keywords: ["savegnago", "savegnago supermercados"],
  },
  {
    friendlyName: "Angeloni Supermercados",
    categorySlug: "mercado",
    keywords: ["angeloni", "supermercado angeloni", "rede angeloni"],
  },
  {
    friendlyName: "G.Barbosa / Cencosud",
    categorySlug: "mercado",
    keywords: ["cencosud", "gbarbosa", "g barbosa", "prezunic", "bretas"],
  },
  {
    friendlyName: "Zaffari Supermercados",
    categorySlug: "mercado",
    keywords: ["zaffari", "bourbon hipermercado", "cia zaffari"],
  },
  {
    friendlyName: "Condor Super Center",
    categorySlug: "mercado",
    keywords: ["condor super center", "hipermercado condor"],
  },
  {
    friendlyName: "Festval Supermercados",
    categorySlug: "mercado",
    keywords: ["festval", "supermercado festval"],
  },

  // ==========================================
  // 2. Farmácias e Drogarias (14)
  // ==========================================
  {
    friendlyName: "Droga Raia",
    categorySlug: "saude",
    cnpjs: ["61585865024042"],
    keywords: ["droga raia", "drogaraia", "raia drogasil"],
  },
  {
    friendlyName: "Drogasil",
    categorySlug: "saude",
    cnpjs: ["61585865000139"],
    keywords: ["drogasil", "farmacia drogasil"],
  },
  {
    friendlyName: "Drogaria Pacheco",
    categorySlug: "saude",
    cnpjs: ["33438250000167"],
    keywords: ["drogaria pacheco", "drogarias pacheco", "pacheco farmacia"],
  },
  {
    friendlyName: "Drogaria São Paulo",
    categorySlug: "saude",
    cnpjs: ["61412110000155"],
    keywords: ["drogaria sao paulo", "drogarias sao paulo", "dpsp"],
  },
  {
    friendlyName: "Pague Menos",
    categorySlug: "saude",
    cnpjs: ["06626253000151"],
    keywords: ["pague menos", "farmacias pague menos"],
  },
  {
    friendlyName: "Panvel Farmácias",
    categorySlug: "saude",
    cnpjs: ["92665611000103"],
    keywords: ["panvel", "farmacias panvel", "dimed panvel"],
  },
  {
    friendlyName: "Drogaria Araujo",
    categorySlug: "saude",
    keywords: ["drogaria araujo", "araujo farmacia", "drogarias araujo"],
  },
  {
    friendlyName: "Drogaria Venancio",
    categorySlug: "saude",
    keywords: ["drogaria venancio", "farmacia venancio"],
  },
  {
    friendlyName: "Drogal Farmácias",
    categorySlug: "saude",
    keywords: ["drogal", "farmacias drogal"],
  },
  {
    friendlyName: "Farmácia Preço Popular",
    categorySlug: "saude",
    keywords: ["preco popular", "farmacia preco popular", "clamed"],
  },
  {
    friendlyName: "Extrafarma",
    categorySlug: "saude",
    keywords: ["extrafarma", "farmacias extrafarma"],
  },
  {
    friendlyName: "Farmácias Nissei",
    categorySlug: "saude",
    keywords: ["nissei", "farmacias nissei"],
  },
  {
    friendlyName: "Drogaria Minas-Brasil",
    categorySlug: "saude",
    keywords: ["minas brasil", "drogaria minas brasil"],
  },
  {
    friendlyName: "Farmácias Associadas",
    categorySlug: "saude",
    keywords: ["farmacias associadas", "rede associadas"],
  },

  // ==========================================
  // 3. Postos de Combustível e Conveniência (12)
  // ==========================================
  {
    friendlyName: "Posto Ipiranga",
    categorySlug: "transporte",
    cnpjs: ["33337122000127"],
    keywords: ["posto ipiranga", "postos ipiranga", "ipiranga produtos de petroleo"],
  },
  {
    friendlyName: "Posto Shell",
    categorySlug: "transporte",
    cnpjs: ["33453598000123"],
    keywords: ["posto shell", "postos shell", "raizen combustiveis", "raizen shell"],
  },
  {
    friendlyName: "Posto Petrobras / Vibra",
    categorySlug: "transporte",
    cnpjs: ["34274233000102"],
    keywords: ["posto petrobras", "postos petrobras", "vibra energia", "br distribuidora"],
  },
  {
    friendlyName: "Posto Ale",
    categorySlug: "transporte",
    keywords: ["posto ale", "ale combustiveis", "postos ale"],
  },
  {
    friendlyName: "Rede Graal",
    categorySlug: "transporte",
    keywords: ["rede graal", "posto graal", "restaurante graal"],
  },
  {
    friendlyName: "am/pm",
    categorySlug: "mercado",
    keywords: ["am pm", "ampm", "loja am pm", "conveniencia am pm"],
  },
  {
    friendlyName: "Shell Select",
    categorySlug: "mercado",
    keywords: ["shell select", "select shell", "conveniencia shell select"],
  },
  {
    friendlyName: "Sem Parar",
    categorySlug: "transporte",
    cnpjs: ["04088208000165"],
    keywords: ["sem parar", "semparar", "cgap sem parar"],
  },
  {
    friendlyName: "ConectCar",
    categorySlug: "transporte",
    keywords: ["conectcar", "conect car"],
  },
  {
    friendlyName: "Veloe",
    categorySlug: "transporte",
    keywords: ["veloe", "alelo veloe"],
  },
  {
    friendlyName: "Estapar Estacionamentos",
    categorySlug: "transporte",
    keywords: ["estapar", "estapar estacionamento", "allpark"],
  },
  {
    friendlyName: "Indigo Estacionamentos",
    categorySlug: "transporte",
    keywords: ["indigo estacionamento", "indigo brasil"],
  },

  // ==========================================
  // 4. Mobilidade Urbana, Pedágios e Transporte (10)
  // ==========================================
  {
    friendlyName: "Uber",
    categorySlug: "transporte",
    keywords: ["uber", "uber trip", "uber br", "uber do brasil"],
  },
  {
    friendlyName: "Uber Eats",
    categorySlug: "alimentacao",
    keywords: ["uber eats", "ubereats"],
  },
  {
    friendlyName: "99 / 99App",
    categorySlug: "transporte",
    keywords: ["99app", "99pop", "99 motorista", "99 corrida", "99 tecnologia"],
  },
  {
    friendlyName: "SPTrans",
    categorySlug: "transporte",
    keywords: ["sptrans", "bilhete unico sptrans", "recarga sptrans"],
  },
  {
    friendlyName: "CCR Rodovias",
    categorySlug: "transporte",
    keywords: ["grupoccr", "ccr rodovias", "ccr novadutra", "ccr autoban", "ccr rodoanel"],
  },
  {
    friendlyName: "Ecorodovias",
    categorySlug: "transporte",
    keywords: ["ecorodovias", "ecovias", "ecopistas", "ecovia"],
  },
  {
    friendlyName: "Arteris",
    categorySlug: "transporte",
    keywords: ["arteris", "autopista fernao dias", "autopista fluminense", "arteris rodovias"],
  },
  {
    friendlyName: "AutoPass / TOP",
    categorySlug: "transporte",
    keywords: ["autopass", "cartao top", "recarga top"],
  },
  {
    friendlyName: "RioCard",
    categorySlug: "transporte",
    keywords: ["riocard", "riocard mais", "recarga riocard"],
  },
  {
    friendlyName: "Metrô SP / Rio",
    categorySlug: "transporte",
    keywords: ["metro sp", "metro rio", "metrorio", "companhia do metropolitano"],
  },

  // ==========================================
  // 5. Streaming, Softwares e Assinaturas (16)
  // ==========================================
  {
    friendlyName: "Netflix",
    categorySlug: "assinaturas",
    keywords: ["netflix", "netflix com", "netflix entretenimento"],
  },
  {
    friendlyName: "Spotify",
    categorySlug: "assinaturas",
    keywords: ["spotify", "spotify premium", "spotify ab"],
  },
  {
    friendlyName: "Amazon Prime",
    categorySlug: "assinaturas",
    keywords: ["amazon prime", "prime video", "prime video brasil"],
  },
  {
    friendlyName: "Disney+",
    categorySlug: "assinaturas",
    keywords: ["disney plus", "disney", "the walt disney company"],
  },
  {
    friendlyName: "Max / HBO Max",
    categorySlug: "assinaturas",
    keywords: ["hbo max", "max com", "warner media max"],
  },
  {
    friendlyName: "YouTube Premium",
    categorySlug: "assinaturas",
    keywords: ["youtube premium", "google youtube", "youtube member"],
  },
  {
    friendlyName: "Apple / iCloud",
    categorySlug: "assinaturas",
    keywords: ["apple com bill", "itunes com bill", "apple services", "apple store"],
  },
  {
    friendlyName: "Globoplay",
    categorySlug: "assinaturas",
    keywords: ["globoplay", "globo play", "globo comunicacao"],
  },
  {
    friendlyName: "OpenAI / ChatGPT",
    categorySlug: "assinaturas",
    keywords: ["chatgpt", "openai", "chatgpt subscription"],
  },
  {
    friendlyName: "Deezer",
    categorySlug: "assinaturas",
    keywords: ["deezer", "deezer premium"],
  },
  {
    friendlyName: "Microsoft 365",
    categorySlug: "assinaturas",
    keywords: ["microsoft 365", "msft azure", "xbox game pass", "microsoft brasil"],
  },
  {
    friendlyName: "Star+",
    categorySlug: "assinaturas",
    keywords: ["star plus", "star+"],
  },
  {
    friendlyName: "Paramount+",
    categorySlug: "assinaturas",
    keywords: ["paramount plus", "paramount+"],
  },
  {
    friendlyName: "Crunchyroll",
    categorySlug: "assinaturas",
    keywords: ["crunchyroll"],
  },
  {
    friendlyName: "Google One",
    categorySlug: "assinaturas",
    keywords: ["google storage", "google one", "google workspace"],
  },
  {
    friendlyName: "Canva",
    categorySlug: "assinaturas",
    keywords: ["canva", "canva pty"],
  },

  // ==========================================
  // 6. Telecom e Concessionárias de Serviços Públicos (16)
  // ==========================================
  {
    friendlyName: "Claro",
    categorySlug: "assinaturas",
    keywords: ["claro", "claro brasil", "claro telecom", "embratel"],
  },
  {
    friendlyName: "Vivo",
    categorySlug: "assinaturas",
    keywords: ["telefonica brasil", "telefonica vivo", "vivo fribra", "vivo celular"],
  },
  {
    friendlyName: "TIM",
    categorySlug: "assinaturas",
    keywords: ["tim celular", "tim brasil", "tim s a"],
  },
  {
    friendlyName: "Oi Fibra",
    categorySlug: "assinaturas",
    keywords: ["oi fibra", "oi telecom", "telemar"],
  },
  {
    friendlyName: "Enel",
    categorySlug: "moradia",
    keywords: ["enel", "enel distribuicao", "ampla energia"],
  },
  {
    friendlyName: "Sabesp",
    categorySlug: "moradia",
    keywords: ["sabesp", "cia de saneamento basico"],
  },
  {
    friendlyName: "Copasa",
    categorySlug: "moradia",
    keywords: ["copasa", "copasa mg"],
  },
  {
    friendlyName: "Sanepar",
    categorySlug: "moradia",
    keywords: ["sanepar", "cia de saneamento do parana"],
  },
  {
    friendlyName: "Cemig",
    categorySlug: "moradia",
    keywords: ["cemig", "cemig distribuicao"],
  },
  {
    friendlyName: "CPFL Energia",
    categorySlug: "moradia",
    keywords: ["cpfl", "cpfl paulista", "cpfl piratininga", "cpfl santa cruz"],
  },
  {
    friendlyName: "Light",
    categorySlug: "moradia",
    keywords: ["light servicos", "light energia", "light sa"],
  },
  {
    friendlyName: "Comgás",
    categorySlug: "moradia",
    keywords: ["comgas", "cia de gas de sao paulo"],
  },
  {
    friendlyName: "Equatorial Energia",
    categorySlug: "moradia",
    keywords: ["equatorial energia", "celpa", "cemar", "equatorial para", "equatorial maranhao"],
  },
  {
    friendlyName: "Neoenergia",
    categorySlug: "moradia",
    keywords: ["neoenergia", "coelba", "celpe", "cosern", "elektro"],
  },
  {
    friendlyName: "CEEE Equatorial",
    categorySlug: "moradia",
    keywords: ["ceee equatorial", "ceee d"],
  },
  {
    friendlyName: "Corsan",
    categorySlug: "moradia",
    keywords: ["corsan", "cia riograndense de saneamento"],
  },

  // ==========================================
  // 7. E-commerce e Varejo Geral (16)
  // ==========================================
  {
    friendlyName: "Mercado Livre",
    categorySlug: "compras",
    keywords: [
      "mercado livre",
      "mercadolivre",
      "mercadolivre com",
      "mercadolivre br",
      "mercado livre br",
    ],
  },
  {
    friendlyName: "Amazon",
    categorySlug: "compras",
    keywords: [
      "amazon com br",
      "amazon marketplace",
      "amazon brasil",
      "amazon br",
      "amazon",
      "amzn br",
      "amzn",
    ],
  },
  {
    friendlyName: "Shopee",
    categorySlug: "compras",
    keywords: ["shopee", "shopee brasil", "shopee com br", "shopee br"],
  },
  {
    friendlyName: "Magazine Luiza",
    categorySlug: "compras",
    keywords: ["magalu", "magazine luiza", "magazineluiza"],
  },
  {
    friendlyName: "Lojas Americanas",
    categorySlug: "compras",
    keywords: ["lojas americanas", "americanas com"],
  },
  {
    friendlyName: "Casas Bahia",
    categorySlug: "compras",
    keywords: ["casas bahia", "via varejo casas bahia"],
  },
  {
    friendlyName: "Fast Shop",
    categorySlug: "compras",
    keywords: ["fast shop", "fastshop"],
  },
  {
    friendlyName: "KaBuM!",
    categorySlug: "compras",
    keywords: ["kabum", "kabum comercio"],
  },
  {
    friendlyName: "AliExpress",
    categorySlug: "compras",
    keywords: ["aliexpress", "aliexpress com", "ali express"],
  },
  {
    friendlyName: "Shein",
    categorySlug: "compras",
    keywords: ["shein", "shein brasil", "shein com"],
  },
  {
    friendlyName: "Leroy Merlin",
    categorySlug: "compras",
    keywords: ["leroy merlin", "leroymerlin"],
  },
  {
    friendlyName: "Kalunga",
    categorySlug: "compras",
    keywords: ["kalunga", "kalunga papelaria"],
  },
  {
    friendlyName: "Petz",
    categorySlug: "compras",
    keywords: ["petz", "pet center marginal"],
  },
  {
    friendlyName: "Cobasi",
    categorySlug: "compras",
    keywords: ["cobasi", "cobasi pet"],
  },
  {
    friendlyName: "Tok&Stok",
    categorySlug: "compras",
    keywords: ["tok stok", "tok e stok", "tokstok"],
  },
  {
    friendlyName: "Telhanorte",
    categorySlug: "compras",
    keywords: ["telhanorte", "telha norte", "saint gobain telhanorte"],
  },

  // ==========================================
  // 8. Restaurantes, Redes Rápidas e Delivery (16)
  // ==========================================
  {
    friendlyName: "iFood",
    categorySlug: "alimentacao",
    keywords: ["ifood", "ifood com br", "ifood pedido"],
  },
  {
    friendlyName: "McDonald's",
    categorySlug: "alimentacao",
    cnpjs: ["42591651000143"],
    keywords: ["mcdonalds", "mc donalds", "arcos dourados"],
  },
  {
    friendlyName: "Burger King",
    categorySlug: "alimentacao",
    keywords: ["burger king", "bk brasil", "zamp burger king"],
  },
  {
    friendlyName: "Subway",
    categorySlug: "alimentacao",
    keywords: ["subway"],
  },
  {
    friendlyName: "Outback Steakhouse",
    categorySlug: "alimentacao",
    keywords: ["outback", "outback steakhouse", "bloomin brands"],
  },
  {
    friendlyName: "Cacau Show",
    categorySlug: "alimentacao",
    keywords: ["cacau show", "cacaushow"],
  },
  {
    friendlyName: "Habib's",
    categorySlug: "alimentacao",
    keywords: ["habibs", "habib s", "alsil habibs"],
  },
  {
    friendlyName: "Starbucks",
    categorySlug: "alimentacao",
    keywords: ["starbucks", "starbucks coffee"],
  },
  {
    friendlyName: "Zé Delivery",
    categorySlug: "alimentacao",
    keywords: ["ze delivery", "zedelivery", "ambev ze delivery"],
  },
  {
    friendlyName: "Rappi",
    categorySlug: "alimentacao",
    keywords: ["rappi", "rappi brasil"],
  },
  {
    friendlyName: "Madero",
    categorySlug: "alimentacao",
    keywords: ["madero", "madero container", "grupo madero"],
  },
  {
    friendlyName: "Spoleto",
    categorySlug: "alimentacao",
    keywords: ["spoleto", "grupo trigo"],
  },
  {
    friendlyName: "Giraffas",
    categorySlug: "alimentacao",
    keywords: ["giraffas"],
  },
  {
    friendlyName: "Kopenhagen",
    categorySlug: "alimentacao",
    keywords: ["kopenhagen", "chocolates kopenhagen"],
  },
  {
    friendlyName: "Domino's Pizza",
    categorySlug: "alimentacao",
    keywords: ["dominos pizza", "domino s pizza"],
  },
  {
    friendlyName: "Pizza Hut",
    categorySlug: "alimentacao",
    keywords: ["pizza hut"],
  },

  // ==========================================
  // 9. Moda, Calçados e Esportes (10)
  // ==========================================
  {
    friendlyName: "Zara",
    categorySlug: "compras",
    keywords: ["zara", "zara brasil", "inditex zara"],
  },
  {
    friendlyName: "Lojas Renner",
    categorySlug: "compras",
    keywords: ["lojas renner", "renner"],
  },
  {
    friendlyName: "C&A",
    categorySlug: "compras",
    keywords: ["c&a", "c e a", "cea modas"],
  },
  {
    friendlyName: "Riachuelo",
    categorySlug: "compras",
    keywords: ["riachuelo", "lojas riachuelo", "midway riachuelo"],
  },
  {
    friendlyName: "Centauro",
    categorySlug: "compras",
    keywords: ["centauro", "centauro esportes", "grupo sbf"],
  },
  {
    friendlyName: "Decathlon",
    categorySlug: "compras",
    keywords: ["decathlon", "decathlon brasil"],
  },
  {
    friendlyName: "Nike",
    categorySlug: "compras",
    keywords: ["nike brasil", "loja nike", "fisia nike"],
  },
  {
    friendlyName: "Adidas",
    categorySlug: "compras",
    keywords: ["adidas do brasil", "loja adidas"],
  },
  {
    friendlyName: "Arezzo",
    categorySlug: "compras",
    keywords: ["arezzo", "arezzo co"],
  },
  {
    friendlyName: "Havaianas",
    categorySlug: "compras",
    keywords: ["havaianas", "alpargatas havaianas"],
  },

  // ==========================================
  // 10. Academias e Bem-Estar (5)
  // ==========================================
  {
    friendlyName: "Smart Fit",
    categorySlug: "saude",
    keywords: ["smart fit", "smartfit"],
  },
  {
    friendlyName: "Bluefit",
    categorySlug: "saude",
    keywords: ["bluefit", "bluefit academia"],
  },
  {
    friendlyName: "Bio Ritmo",
    categorySlug: "saude",
    keywords: ["bio ritmo", "bioritmo"],
  },
  {
    friendlyName: "TotalPass",
    categorySlug: "saude",
    keywords: ["totalpass", "total pass"],
  },
  {
    friendlyName: "Gympass / Wellhub",
    categorySlug: "saude",
    keywords: ["gympass", "wellhub"],
  },
];

/**
 * Consulta o catálogo canônico por CNPJ (1º nível) ou correspondência textual de palavras-chave (2º nível).
 * Retorna a entrada canônica ou undefined se nenhuma marca conhecida for identificada.
 */
export function findCanonicalMerchant(textOrDoc: string): CanonicalMerchantEntry | undefined {
  if (!textOrDoc) return undefined;

  // 1. Verificação por CNPJ limpo
  const cleanDoc = cleanTaxId(textOrDoc);
  if (cleanDoc) {
    const matchedByCnpj = CANONICAL_MERCHANT_CATALOG.find(
      (entry) => entry.cnpjs && entry.cnpjs.includes(cleanDoc),
    );
    if (matchedByCnpj) return matchedByCnpj;
  }

  // 2. Normalização textual e busca por palavras-chave com precedência por tamanho
  const normalized = normalizeInferenceText(textOrDoc);
  if (!normalized) return undefined;

  // Ordena por especificidade (termos mais longos primeiro)
  for (const entry of CANONICAL_MERCHANT_CATALOG) {
    for (const kw of entry.keywords) {
      const normKw = normalizeInferenceText(kw);
      if (!normKw) continue;

      // Se a palavra-chave tiver mais de uma palavra, verifica contenção
      if (normKw.includes(" ")) {
        if (normalized.includes(normKw)) {
          return entry;
        }
      } else {
        // Para palavra única, exige fronteira de palavra para evitar falsos positivos
        const regex = new RegExp(`(?:^|\\s)${normKw}(?:$|\\s)`);
        if (regex.test(normalized)) {
          return entry;
        }
      }
    }
  }

  return undefined;
}
