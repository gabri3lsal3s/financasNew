import type { AssetCurrency, PortfolioAsset } from "@/types";
import { inferAssetClassFromTicker } from "./import-parser";
import { inferCurrencyFromTicker, normalizeClassName } from "./valuation";

export interface CatalogTickerItem {
  ticker: string;
  name: string;
  assetClass: string;
  sector?: string;
  currency: AssetCurrency;
}

export interface TickerSearchResult extends CatalogTickerItem {
  isExisting: boolean;
  existingAssetId?: string;
  currentQuantity?: number;
  currentAveragePrice?: number;
}

export interface AporteSuggestionItem {
  assetId: string;
  ticker: string;
  assetClass: string;
  sector?: string;
  currentValueBRL: number;
  targetValueBRL: number;
  gapBRL: number;
  targetPercentage: number;
  currentPercentage: number;
}

/**
 * Setores canônicos recomendados por classe para sugestões e autocomplete.
 */
export const DEFAULT_SECTORS_BY_CLASS: Record<string, readonly string[]> = {
  "Ações": [
    "Financeiro / Bancos",
    "Energia Elétrica",
    "Saneamento e Utilidades",
    "Petróleo, Gás e Combustíveis",
    "Mineração e Siderurgia",
    "Bens de Capital / Máquinas",
    "Saúde / Farmácias",
    "Consumo / Varejo",
    "Tecnologia / Software",
    "Telecomunicações",
    "Seguros e Previdência",
    "Papel e Celulose",
    "Alimentos e Bebidas",
    "Construção e Incorporação",
    "Transporte e Logística",
    "Outros",
  ],
  "FIIs": [
    "Imobiliário / Papel e CRI",
    "Imobiliário / Logística",
    "Imobiliário / Shoppings",
    "Imobiliário / Renda Urbana",
    "Imobiliário / Lajes Corporativas",
    "Imobiliário / Híbrido",
    "Imobiliário / FOFs",
    "Agro / FIAGRO",
    "Infraestrutura / FI-Infra",
    "Outros",
  ],
  "Renda Fixa": [
    "Pós-fixado (Selic / CDI)",
    "Inflação (IPCA+)",
    "Prefixado",
    "Crédito Privado (CRI / CRA / Debêntures)",
    "Títulos Públicos",
    "Outros",
  ],
  "Internacional": [
    "Tecnologia & Software",
    "Comunicação & Mídia",
    "Financeiro & Pagamentos",
    "Saúde & Farmacêutica",
    "Consumo & Varejo",
    "Energia & Petróleo",
    "Industrial & Defesa",
    "REITs / Imobiliário",
    "Neutro Global (All-World)",
    "Mercado Amplo US (S&P 500)",
    "Mercados Emergentes",
    "Bonds / Renda Fixa Global",
    "Outros",
  ],
  "ETFs": [
    "Índice Brasil (Ibovespa / Small Caps)",
    "Índice Internacional (S&P 500 / Nasdaq)",
    "Criptoativos",
    "Commodities / Ouro",
    "Renda Fixa / Títulos",
    "Outros",
  ],
  "BDRs": [
    "Tecnologia & Software",
    "Consumo & Varejo",
    "Financeiro",
    "Saúde & Farmacêutica",
    "Outros",
  ],
  "Cripto": [
    "Layer 1 / Reserva (BTC / ETH / SOL)",
    "Stablecoins (USD)",
    "DeFi & Protocolos",
    "Outros",
  ],
  "Caixa": [
    "Reserva de Emergência / Liquidez",
    "Saldo em Caixa",
    "Outros",
  ],
};

/**
 * Catálogo curado dos principais ativos da B3 e mercado global.
 * Utilizado para autocomplete inteligente e inferência rápida no Investment Wizard.
 */
export const CURATED_TICKERS_CATALOG: readonly CatalogTickerItem[] = [
  // Ações B3 (Ibovespa Top 30)
  { ticker: "PETR4", name: "Petróleo Brasileiro S.A. Petrobras PN", assetClass: "Ações", sector: "Petróleo, Gás e Combustíveis", currency: "BRL" },
  { ticker: "PETR3", name: "Petróleo Brasileiro S.A. Petrobras ON", assetClass: "Ações", sector: "Petróleo, Gás e Combustíveis", currency: "BRL" },
  { ticker: "VALE3", name: "Vale S.A. ON", assetClass: "Ações", sector: "Mineração e Siderurgia", currency: "BRL" },
  { ticker: "ITUB4", name: "Itaú Unibanco Holding S.A. PN", assetClass: "Ações", sector: "Financeiro / Bancos", currency: "BRL" },
  { ticker: "BBDC4", name: "Banco Bradesco S.A. PN", assetClass: "Ações", sector: "Financeiro / Bancos", currency: "BRL" },
  { ticker: "BBAS3", name: "Banco do Brasil S.A. ON", assetClass: "Ações", sector: "Financeiro / Bancos", currency: "BRL" },
  { ticker: "WEGE3", name: "WEG S.A. ON", assetClass: "Ações", sector: "Bens de Capital / Máquinas", currency: "BRL" },
  { ticker: "ABEV3", name: "Ambev S.A. ON", assetClass: "Ações", sector: "Alimentos e Bebidas", currency: "BRL" },
  { ticker: "RENT3", name: "Localiza Rent a Car S.A. ON", assetClass: "Ações", sector: "Transporte e Logística", currency: "BRL" },
  { ticker: "ELET3", name: "Centrais Elétricas Brasileiras S.A. ON", assetClass: "Ações", sector: "Energia Elétrica", currency: "BRL" },
  { ticker: "ELET6", name: "Centrais Elétricas Brasileiras S.A. PNB", assetClass: "Ações", sector: "Energia Elétrica", currency: "BRL" },
  { ticker: "ITSA4", name: "Itaúsa S.A. PN", assetClass: "Ações", sector: "Financeiro / Bancos", currency: "BRL" },
  { ticker: "PRIO3", name: "PetroRio S.A. ON", assetClass: "Ações", sector: "Petróleo, Gás e Combustíveis", currency: "BRL" },
  { ticker: "GGBR4", name: "Gerdau S.A. PN", assetClass: "Ações", sector: "Mineração e Siderurgia", currency: "BRL" },
  { ticker: "CSNA3", name: "Companhia Siderúrgica Nacional ON", assetClass: "Ações", sector: "Mineração e Siderurgia", currency: "BRL" },
  { ticker: "SUZB3", name: "Suzano S.A. ON", assetClass: "Ações", sector: "Papel e Celulose", currency: "BRL" },
  { ticker: "JBSS3", name: "JBS S.A. ON", assetClass: "Ações", sector: "Alimentos e Bebidas", currency: "BRL" },
  { ticker: "RADL3", name: "Raia Drogasil S.A. ON", assetClass: "Ações", sector: "Saúde / Farmácias", currency: "BRL" },
  { ticker: "VIVT3", name: "Telefônica Brasil S.A. ON", assetClass: "Ações", sector: "Telecomunicações", currency: "BRL" },
  { ticker: "EQTL3", name: "Equatorial Energia S.A. ON", assetClass: "Ações", sector: "Energia Elétrica", currency: "BRL" },
  { ticker: "SBSP3", name: "Sabesp S.A. ON", assetClass: "Ações", sector: "Saneamento e Utilidades", currency: "BRL" },
  { ticker: "CPLE6", name: "Copel PNB", assetClass: "Ações", sector: "Energia Elétrica", currency: "BRL" },
  { ticker: "CMIG4", name: "Cemig PN", assetClass: "Ações", sector: "Energia Elétrica", currency: "BRL" },
  { ticker: "TAEE11", name: "Taesa Unit", assetClass: "Ações", sector: "Energia Elétrica", currency: "BRL" },
  { ticker: "EGIE3", name: "Engie Brasil S.A. ON", assetClass: "Ações", sector: "Energia Elétrica", currency: "BRL" },
  { ticker: "BBSE3", name: "BB Seguridade Participações S.A. ON", assetClass: "Ações", sector: "Seguros e Previdência", currency: "BRL" },
  { ticker: "CXSE3", name: "Caixa Seguridade Participações S.A. ON", assetClass: "Ações", sector: "Seguros e Previdência", currency: "BRL" },
  { ticker: "KLBN11", name: "Klabin S.A. Unit", assetClass: "Ações", sector: "Papel e Celulose", currency: "BRL" },
  { ticker: "TOTS3", name: "Totvs S.A. ON", assetClass: "Ações", sector: "Tecnologia / Software", currency: "BRL" },
  { ticker: "LREN3", name: "Lojas Renner S.A. ON", assetClass: "Ações", sector: "Consumo / Varejo", currency: "BRL" },
  { ticker: "MGLU3", name: "Magazine Luiza S.A. ON", assetClass: "Ações", sector: "Consumo / Varejo", currency: "BRL" },
  { ticker: "B3SA3", name: "B3 S.A. Brasil, Bolsa, Balcão ON", assetClass: "Ações", sector: "Financeiro / Bancos", currency: "BRL" },

  // FIIs e FIAGROs B3 (IFIX Top 25)
  { ticker: "MXRF11", name: "Maxi Renda FII", assetClass: "FIIs", sector: "Imobiliário / Papel e CRI", currency: "BRL" },
  { ticker: "HGLG11", name: "CSHG Logística FII", assetClass: "FIIs", sector: "Imobiliário / Logística", currency: "BRL" },
  { ticker: "KNIP11", name: "Kinea Índice de Preços FII", assetClass: "FIIs", sector: "Imobiliário / Papel e CRI", currency: "BRL" },
  { ticker: "KNCR11", name: "Kinea Rendimentos Imobiliários FII", assetClass: "FIIs", sector: "Imobiliário / Papel e CRI", currency: "BRL" },
  { ticker: "XPLG11", name: "XP Log FII", assetClass: "FIIs", sector: "Imobiliário / Logística", currency: "BRL" },
  { ticker: "XPML11", name: "XP Malls FII", assetClass: "FIIs", sector: "Imobiliário / Shoppings", currency: "BRL" },
  { ticker: "VISC11", name: "Vinci Shopping Centers FII", assetClass: "FIIs", sector: "Imobiliário / Shoppings", currency: "BRL" },
  { ticker: "BTLG11", name: "BTG Pactual Logística FII", assetClass: "FIIs", sector: "Imobiliário / Logística", currency: "BRL" },
  { ticker: "CPTS11", name: "Capitânia Securities II FII", assetClass: "FIIs", sector: "Imobiliário / Papel e CRI", currency: "BRL" },
  { ticker: "HGRU11", name: "CSHG Renda Urbana FII", assetClass: "FIIs", sector: "Imobiliário / Renda Urbana", currency: "BRL" },
  { ticker: "TGAR11", name: "TG Ativo Real FII", assetClass: "FIIs", sector: "Imobiliário / Renda Urbana", currency: "BRL" },
  { ticker: "HGCR11", name: "CSHG Recebíveis Imobiliários FII", assetClass: "FIIs", sector: "Imobiliário / Papel e CRI", currency: "BRL" },
  { ticker: "VRTA11", name: "Fator Veritá FII", assetClass: "FIIs", sector: "Imobiliário / Papel e CRI", currency: "BRL" },
  { ticker: "IRDM11", name: "Iridium Recebíveis Imobiliários FII", assetClass: "FIIs", sector: "Imobiliário / Papel e CRI", currency: "BRL" },
  { ticker: "RBRR11", name: "RBR Rendimento High Grade FII", assetClass: "FIIs", sector: "Imobiliário / Papel e CRI", currency: "BRL" },
  { ticker: "PVBI11", name: "VBI Prime Properties FII", assetClass: "FIIs", sector: "Imobiliário / Lajes Corporativas", currency: "BRL" },
  { ticker: "VINO11", name: "Vinci Offices FII", assetClass: "FIIs", sector: "Imobiliário / Lajes Corporativas", currency: "BRL" },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária FII", assetClass: "FIIs", sector: "Imobiliário / Híbrido", currency: "BRL" },
  { ticker: "VGIR11", name: "Valora RE III FII", assetClass: "FIIs", sector: "Imobiliário / Papel e CRI", currency: "BRL" },
  { ticker: "RZTR11", name: "Riza Terrax FII", assetClass: "FIIs", sector: "Agro / FIAGRO", currency: "BRL" },
  { ticker: "VGIA11", name: "Valora CRA FIAGRO", assetClass: "FIIs", sector: "Agro / FIAGRO", currency: "BRL" },
  { ticker: "KNCA11", name: "Kinea Crédito Agro FIAGRO", assetClass: "FIIs", sector: "Agro / FIAGRO", currency: "BRL" },
  { ticker: "RURA11", name: "Itaú Asset Rural FIAGRO", assetClass: "FIIs", sector: "Agro / FIAGRO", currency: "BRL" },

  // ETFs B3
  { ticker: "BOVA11", name: "iShares Ibovespa ETF", assetClass: "ETFs", sector: "Índice Brasil (Ibovespa / Small Caps)", currency: "BRL" },
  { ticker: "IVVB11", name: "iShares S&P 500 Fundo de Índice", assetClass: "ETFs", sector: "Índice Internacional (S&P 500 / Nasdaq)", currency: "BRL" },
  { ticker: "SPXI11", name: "Trend ETF S&P 500", assetClass: "ETFs", sector: "Índice Internacional (S&P 500 / Nasdaq)", currency: "BRL" },
  { ticker: "SMAL11", name: "iShares BM&FBOVESPA Small Cap ETF", assetClass: "ETFs", sector: "Índice Brasil (Ibovespa / Small Caps)", currency: "BRL" },
  { ticker: "HASH11", name: "Hashdex Nasdaq Crypto Index ETF", assetClass: "ETFs", sector: "Criptoativos", currency: "BRL" },
  { ticker: "GOLD11", name: "Trend ETF Ouro Fundo de Índice", assetClass: "ETFs", sector: "Commodities / Ouro", currency: "BRL" },
  { ticker: "NASD11", name: "Trend ETF Nasdaq 100", assetClass: "ETFs", sector: "Índice Internacional (S&P 500 / Nasdaq)", currency: "BRL" },
  { ticker: "BDEF11", name: "Trend ETF Dólar Fundo de Índice", assetClass: "ETFs", sector: "Commodities / Ouro", currency: "BRL" },

  // BDRs B3
  { ticker: "AAPL34", name: "Apple Inc. BDR", assetClass: "BDRs", sector: "Tecnologia & Software", currency: "BRL" },
  { ticker: "MSFT34", name: "Microsoft Corporation BDR", assetClass: "BDRs", sector: "Tecnologia & Software", currency: "BRL" },
  { ticker: "NVDC34", name: "NVIDIA Corporation BDR", assetClass: "BDRs", sector: "Tecnologia & Software", currency: "BRL" },
  { ticker: "AMZO34", name: "Amazon.com Inc. BDR", assetClass: "BDRs", sector: "Consumo & Varejo", currency: "BRL" },
  { ticker: "GOGL34", name: "Alphabet Inc. (Google) BDR", assetClass: "BDRs", sector: "Tecnologia & Software", currency: "BRL" },
  { ticker: "TSLA34", name: "Tesla Inc. BDR", assetClass: "BDRs", sector: "Consumo & Varejo", currency: "BRL" },
  { ticker: "META34", name: "Meta Platforms Inc. BDR", assetClass: "BDRs", sector: "Tecnologia & Software", currency: "BRL" },
  { ticker: "BERK34", name: "Berkshire Hathaway Inc. BDR", assetClass: "BDRs", sector: "Financeiro", currency: "BRL" },

  // Renda Fixa & Títulos Públicos (Tesouro Direto)
  { ticker: "TESOURO SELIC 2026", name: "Tesouro Selic 2026 (LFT)", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "TESOURO SELIC 2027", name: "Tesouro Selic 2027 (LFT)", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "TESOURO SELIC 2029", name: "Tesouro Selic 2029 (LFT)", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "TESOURO SELIC 2031", name: "Tesouro Selic 2031 (LFT)", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "TESOURO IPCA+ 2029", name: "Tesouro IPCA+ 2029 (NTN-B Principal)", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO IPCA+ 2035", name: "Tesouro IPCA+ 2035 (NTN-B Principal)", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO IPCA+ 2045", name: "Tesouro IPCA+ 2045 (NTN-B Principal)", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO IPCA+ 2050", name: "Tesouro IPCA+ 2050 (NTN-B Principal)", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO IPCA+ COM JUROS SEMESTRAIS 2032", name: "Tesouro IPCA+ com Juros Semestrais 2032 (NTN-B)", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO IPCA+ COM JUROS SEMESTRAIS 2040", name: "Tesouro IPCA+ com Juros Semestrais 2040 (NTN-B)", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO IPCA+ COM JUROS SEMESTRAIS 2055", name: "Tesouro IPCA+ com Juros Semestrais 2055 (NTN-B)", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO PREFIXADO 2026", name: "Tesouro Prefixado 2026 (LTN)", assetClass: "Renda Fixa", sector: "Prefixado", currency: "BRL" },
  { ticker: "TESOURO PREFIXADO 2027", name: "Tesouro Prefixado 2027 (LTN)", assetClass: "Renda Fixa", sector: "Prefixado", currency: "BRL" },
  { ticker: "TESOURO PREFIXADO 2029", name: "Tesouro Prefixado 2029 (LTN)", assetClass: "Renda Fixa", sector: "Prefixado", currency: "BRL" },
  { ticker: "TESOURO PREFIXADO 2031", name: "Tesouro Prefixado 2031 (LTN)", assetClass: "Renda Fixa", sector: "Prefixado", currency: "BRL" },
  { ticker: "TESOURO PREFIXADO COM JUROS SEMESTRAIS 2033", name: "Tesouro Prefixado com Juros Semestrais 2033 (NTN-F)", assetClass: "Renda Fixa", sector: "Prefixado", currency: "BRL" },
  { ticker: "TESOURO PREFIXADO COM JUROS SEMESTRAIS 2035", name: "Tesouro Prefixado com Juros Semestrais 2035 (NTN-F)", assetClass: "Renda Fixa", sector: "Prefixado", currency: "BRL" },
  { ticker: "TESOURO RENDA+ 2030", name: "Tesouro Renda+ Aposentadoria Extra 2030", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO RENDA+ 2035", name: "Tesouro Renda+ Aposentadoria Extra 2035", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO RENDA+ 2040", name: "Tesouro Renda+ Aposentadoria Extra 2040", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO RENDA+ 2045", name: "Tesouro Renda+ Aposentadoria Extra 2045", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO RENDA+ 2050", name: "Tesouro Renda+ Aposentadoria Extra 2050", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO RENDA+ 2055", name: "Tesouro Renda+ Aposentadoria Extra 2055", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO RENDA+ 2060", name: "Tesouro Renda+ Aposentadoria Extra 2060", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO RENDA+ 2065", name: "Tesouro Renda+ Aposentadoria Extra 2065", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO EDUCA+ 2026", name: "Tesouro Educa+ 2026", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO EDUCA+ 2030", name: "Tesouro Educa+ 2030", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO EDUCA+ 2035", name: "Tesouro Educa+ 2035", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "TESOURO EDUCA+ 2040", name: "Tesouro Educa+ 2040", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },

  // Renda Fixa Privada (Modelos Paramétricos Marco Zero)
  { ticker: "CDB 100% CDI", name: "CDB 100% do CDI Liquidez Diária", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "CDB 110% CDI", name: "CDB 110% do CDI", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "CDB 120% CDI", name: "CDB 120% do CDI", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "CDB PREFIXADO 12%", name: "CDB Prefixado 12% a.a.", assetClass: "Renda Fixa", sector: "Prefixado", currency: "BRL" },
  { ticker: "CDB PREFIXADO 14%", name: "CDB Prefixado 14% a.a.", assetClass: "Renda Fixa", sector: "Prefixado", currency: "BRL" },
  { ticker: "LCI 90% CDI", name: "LCI 90% do CDI (Isenta de IR)", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "LCI 95% CDI", name: "LCI 95% do CDI (Isenta de IR)", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "LCA 90% CDI", name: "LCA 90% do CDI (Isenta de IR)", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "LCA 95% CDI", name: "LCA 95% do CDI (Isenta de IR)", assetClass: "Renda Fixa", sector: "Pós-fixado (Selic / CDI)", currency: "BRL" },
  { ticker: "LCI IPCA+ 6%", name: "LCI IPCA + 6% a.a. (Isenta de IR)", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "LCA IPCA+ 6%", name: "LCA IPCA + 6% a.a. (Isenta de IR)", assetClass: "Renda Fixa", sector: "Inflação (IPCA+)", currency: "BRL" },
  { ticker: "CRI", name: "Certificado de Recebíveis Imobiliários (Isento)", assetClass: "Renda Fixa", sector: "Crédito Privado (CRI / CRA / Debêntures)", currency: "BRL" },
  { ticker: "CRA", name: "Certificado de Recebíveis do Agronegócio (Isento)", assetClass: "Renda Fixa", sector: "Crédito Privado (CRI / CRA / Debêntures)", currency: "BRL" },
  { ticker: "DEBÊNTURE INCENTIVADA", name: "Debênture de Infraestrutura (Isenta de IR)", assetClass: "Renda Fixa", sector: "Crédito Privado (CRI / CRA / Debêntures)", currency: "BRL" },
  { ticker: "CAIXA", name: "Saldo em Caixa / Conta Corrente", assetClass: "Caixa", sector: "Saldo em Caixa", currency: "BRL" },
  { ticker: "RESERVA-EMERGENCIA", name: "Reserva de Emergência", assetClass: "Caixa", sector: "Reserva de Emergência / Liquidez", currency: "BRL" },

  // Criptoativos
  { ticker: "BTC", name: "Bitcoin", assetClass: "Cripto", sector: "Layer 1 / Reserva (BTC / ETH / SOL)", currency: "BRL" },
  { ticker: "ETH", name: "Ethereum", assetClass: "Cripto", sector: "Layer 1 / Reserva (BTC / ETH / SOL)", currency: "BRL" },
  { ticker: "SOL", name: "Solana", assetClass: "Cripto", sector: "Layer 1 / Reserva (BTC / ETH / SOL)", currency: "BRL" },
  { ticker: "USDT", name: "Tether USD", assetClass: "Cripto", sector: "Stablecoins (USD)", currency: "USD" },
  { ticker: "USDC", name: "USD Coin", assetClass: "Cripto", sector: "Stablecoins (USD)", currency: "USD" },

  // Ativos Globais / EUA (Internacional)
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", assetClass: "Internacional", sector: "Mercado Amplo US (S&P 500)", currency: "USD" },
  { ticker: "IVV", name: "iShares Core S&P 500 ETF", assetClass: "Internacional", sector: "Mercado Amplo US (S&P 500)", currency: "USD" },
  { ticker: "QQQ", name: "Invesco QQQ Trust (Nasdaq 100)", assetClass: "Internacional", sector: "Tecnologia & Software", currency: "USD" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "Internacional", sector: "Mercado Amplo US (S&P 500)", currency: "USD" },
  { ticker: "VT", name: "Vanguard Total World Stock ETF", assetClass: "Internacional", sector: "Neutro Global (All-World)", currency: "USD" },
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", assetClass: "Internacional", sector: "Mercado Amplo US (S&P 500)", currency: "USD" },
  { ticker: "VNQ", name: "Vanguard Real Estate ETF (REITs)", assetClass: "Internacional", sector: "REITs / Imobiliário", currency: "USD" },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", assetClass: "Internacional", sector: "Bonds / Renda Fixa Global", currency: "USD" },
  { ticker: "AAPL", name: "Apple Inc.", assetClass: "Internacional", sector: "Tecnologia & Software", currency: "USD" },
  { ticker: "MSFT", name: "Microsoft Corporation", assetClass: "Internacional", sector: "Tecnologia & Software", currency: "USD" },
  { ticker: "NVDA", name: "NVIDIA Corporation", assetClass: "Internacional", sector: "Tecnologia & Software", currency: "USD" },
  { ticker: "AMZN", name: "Amazon.com Inc.", assetClass: "Internacional", sector: "Consumo & Varejo", currency: "USD" },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A", assetClass: "Internacional", sector: "Tecnologia & Software", currency: "USD" },
  { ticker: "META", name: "Meta Platforms Inc.", assetClass: "Internacional", sector: "Tecnologia & Software", currency: "USD" },
  { ticker: "TSLA", name: "Tesla Inc.", assetClass: "Internacional", sector: "Consumo & Varejo", currency: "USD" },
  { ticker: "BRK.B", name: "Berkshire Hathaway Inc. Class B", assetClass: "Internacional", sector: "Financeiro & Pagamentos", currency: "USD" },
  { ticker: "JNJ", name: "Johnson & Johnson", assetClass: "Internacional", sector: "Saúde & Farmacêutica", currency: "USD" },
  { ticker: "V", name: "Visa Inc.", assetClass: "Internacional", sector: "Financeiro & Pagamentos", currency: "USD" },
  { ticker: "KO", name: "The Coca-Cola Company", assetClass: "Internacional", sector: "Consumo & Varejo", currency: "USD" },
  { ticker: "PEP", name: "PepsiCo Inc.", assetClass: "Internacional", sector: "Consumo & Varejo", currency: "USD" },
  { ticker: "O", name: "Realty Income Corporation (The Monthly Dividend Company)", assetClass: "Internacional", sector: "REITs / Imobiliário", currency: "USD" },
  { ticker: "T", name: "AT&T Inc.", assetClass: "Internacional", sector: "Comunicação & Mídia", currency: "USD" },
  { ticker: "C", name: "Citigroup Inc.", assetClass: "Internacional", sector: "Financeiro & Pagamentos", currency: "USD" },
  { ticker: "SCHD", name: "Schwab U.S. Dividend Equity ETF", assetClass: "Internacional", sector: "Mercado Amplo US (S&P 500)", currency: "USD" },
];

/**
 * Normaliza uma string de texto removendo acentos (NFD) e pontuação para busca fonética/tokenizada.
 */
export function normalizeSearchToken(str: string): string {
  return str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, " ")
    .trim();
}

/**
 * Infere o setor recomendado com base no ticker e na classe.
 */
export function inferSectorFromTicker(ticker: string, assetClass?: string | null): string {
  const t = cleanTicker(ticker);

  // Busca primeiro no catálogo
  const catalogMatch = CURATED_TICKERS_CATALOG.find((c) => c.ticker === t);
  if (catalogMatch?.sector) return catalogMatch.sector;

  // Heurísticas de Títulos Públicos e Renda Fixa
  if (t.includes("SELIC") || t.includes("CDI") || t.includes("DI") || t === "LFT") {
    return "Pós-fixado (Selic / CDI)";
  }
  if (t.includes("IPCA") || t.includes("RENDA") || t.includes("EDUCA") || t.includes("NTNB") || t.includes("NTN-B")) {
    return "Inflação (IPCA+)";
  }
  if (t.includes("PREFIXADO") || t.includes("PRE") || t === "LTN" || t.includes("NTNF") || t.includes("NTN-F")) {
    return "Prefixado";
  }

  // Heurísticas de Cripto
  if (t === "BTC" || t === "ETH" || t === "SOL" || t.startsWith("BTC") || t.startsWith("ETH")) {
    return "Layer 1 / Reserva (BTC / ETH / SOL)";
  }
  if (t === "USDT" || t === "USDC" || t.includes("USD")) {
    return "Stablecoins (USD)";
  }

  // Heurísticas de Caixa
  if (t.includes("CAIXA") || t.includes("RESERVA")) {
    return "Saldo em Caixa";
  }

  // Heurísticas de FIIs
  if (t.endsWith("11") && assetClass === "FIIs") {
    return "Imobiliário / Papel e CRI";
  }

  // Default da classe se disponível
  const classKey = assetClass ?? "Ações";
  const defaultList = DEFAULT_SECTORS_BY_CLASS[classKey];
  return defaultList?.[0] ?? "Geral";
}

/**
 * Sanitiza um ticker livre para uppercase e trim.
 */
export function cleanTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Pesquisa no catálogo e mescla com ativos já cadastrados na carteira do usuário.
 * Utiliza sistema de pontuação de relevância multi-token com normalização NFD.
 */
export function searchTickers(
  query: string,
  existingAssets: readonly PortfolioAsset[] = [],
  limit = 8,
): TickerSearchResult[] {
  const q = cleanTicker(query);
  const qNorm = normalizeSearchToken(query);
  const qTokens = qNorm.split(/\s+/).filter(Boolean);
  const existingMap = new Map(existingAssets.map((a) => [cleanTicker(a.ticker), a]));

  // 1. Se houver query vazia, sugere os ativos já existentes na carteira primeiro
  if (!q || qTokens.length === 0) {
    const results: TickerSearchResult[] = [];
    const seenTickers = new Set<string>();

    for (const asset of existingAssets) {
      const t = cleanTicker(asset.ticker);
      if (seenTickers.has(t)) continue;
      seenTickers.add(t);

      const catalogMatch = CURATED_TICKERS_CATALOG.find((c) => c.ticker === t);
      const sector = asset.sector ?? catalogMatch?.sector ?? inferSectorFromTicker(t, asset.asset_class ?? catalogMatch?.assetClass);
      results.push({
        ticker: t,
        name: catalogMatch?.name ?? asset.notes ?? t,
        assetClass: asset.asset_class ?? catalogMatch?.assetClass ?? "Outros",
        sector,
        currency: asset.currency,
        isExisting: true,
        existingAssetId: asset.id,
        currentQuantity: asset.quantity,
        currentAveragePrice: asset.average_price,
      });
      if (results.length >= limit) return results;
    }
    return results;
  }

  interface ScoredCandidate {
    result: TickerSearchResult;
    score: number;
  }

  const scoredCandidates: ScoredCandidate[] = [];
  const seenTickers = new Set<string>();

  const evaluateMatch = (
    ticker: string,
    name: string,
    assetClass: string,
    sector: string,
    currency: AssetCurrency,
    isExisting: boolean,
    existingAssetId?: string,
    currentQuantity?: number,
    currentAveragePrice?: number,
  ) => {
    const t = cleanTicker(ticker);
    if (seenTickers.has(t)) return;

    const tNorm = normalizeSearchToken(ticker);
    const nNorm = normalizeSearchToken(name);
    const combinedNorm = `${tNorm} ${nNorm}`;

    // Avalia match multi-token: todos os tokens da busca precisam estar presentes
    const allTokensMatch = qTokens.every((tok) => combinedNorm.includes(tok));
    if (!allTokensMatch) return;

    seenTickers.add(t);

    let score = 50;
    if (tNorm === qNorm) {
      score = 0; // Match exato no ticker
    } else if (tNorm.startsWith(qNorm)) {
      score = 10; // Prefixo no ticker
    } else if (nNorm.startsWith(qNorm)) {
      score = 20; // Prefixo no nome
    } else if (tNorm.includes(qNorm)) {
      score = 30; // Substring no ticker
    } else if (nNorm.includes(qNorm)) {
      score = 40; // Substring no nome
    }

    // Prioridade para ativos que o usuário já possui
    if (isExisting) {
      score -= 5;
    }

    scoredCandidates.push({
      score,
      result: {
        ticker: t,
        name,
        assetClass,
        sector,
        currency,
        isExisting,
        existingAssetId,
        currentQuantity,
        currentAveragePrice,
      },
    });
  };

  // Avalia ativos existentes da carteira
  for (const asset of existingAssets) {
    const catalogMatch = CURATED_TICKERS_CATALOG.find((c) => c.ticker === cleanTicker(asset.ticker));
    const sector = asset.sector ?? catalogMatch?.sector ?? inferSectorFromTicker(asset.ticker, asset.asset_class ?? catalogMatch?.assetClass);
    evaluateMatch(
      asset.ticker,
      catalogMatch?.name ?? asset.notes ?? asset.ticker,
      asset.asset_class ?? catalogMatch?.assetClass ?? "Outros",
      sector,
      asset.currency,
      true,
      asset.id,
      asset.quantity,
      asset.average_price,
    );
  }

  // Avalia catálogo curado
  for (const item of CURATED_TICKERS_CATALOG) {
    const existing = existingMap.get(item.ticker);
    evaluateMatch(
      item.ticker,
      item.name,
      item.assetClass,
      existing?.sector ?? item.sector ?? inferSectorFromTicker(item.ticker, item.assetClass),
      item.currency,
      existing !== undefined,
      existing?.id,
      existing?.quantity,
      existing?.average_price,
    );
  }

  // Se a query não foi contemplada exatamente no catálogo/carteira, oferece como novo ativo livre
  if (q.length >= 1 && !seenTickers.has(q)) {
    const inferredClass = inferAssetClassFromTicker(q) ?? "Ações";
    const inferredCurrency = inferCurrencyFromTicker(q);
    const inferredSector = inferSectorFromTicker(q, inferredClass);
    scoredCandidates.push({
      score: 45, // Prioridade após matches exatos e prefixos, antes de substrings
      result: {
        ticker: q,
        name: `Ativo personalizado (${q})`,
        assetClass: inferredClass,
        sector: inferredSector,
        currency: inferredCurrency,
        isExisting: false,
      },
    });
  }

  return scoredCandidates
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((c) => c.result);
}

/**
 * Gera sugestões preditivas de aporte baseadas na lógica hierárquica
 * (defasagem macro da classe -> maior gap financeiro do ativo em relação às metas).
 */
export function buildAporteSuggestions(
  assets: readonly PortfolioAsset[],
  assetRows: readonly {
    assetId: string;
    ticker: string;
    valueBRL: number;
    pct: number;
    assetClass?: string | null;
    sector?: string | null;
  }[],
  targets: readonly { asset_id: string; target_percentage: number }[],
  totalPortfolioBRL: number,
  limit = 3,
  classTargets?: readonly { name: string; target_percentage: number }[],
  sectorTargets?: readonly { className: string; sectorName: string; target_percentage: number }[],
): AporteSuggestionItem[] {
  const hasTargets = targets.length > 0 || (classTargets && classTargets.length > 0) || (sectorTargets && sectorTargets.length > 0);
  if (totalPortfolioBRL <= 0 || !hasTargets) return [];

  const targetMap = new Map(targets.map((t) => [t.asset_id, t.target_percentage]));
  const classTargetMap = new Map((classTargets ?? []).map((t) => [normalizeClassName(t.name), t.target_percentage]));

  const sectorTargetMap = new Map<string, Map<string, number>>();
  for (const st of sectorTargets ?? []) {
    const normClass = normalizeClassName(st.className);
    let sMap = sectorTargetMap.get(normClass);
    if (!sMap) {
      sMap = new Map<string, number>();
      sectorTargetMap.set(normClass, sMap);
    }
    sMap.set(st.sectorName.trim(), st.target_percentage);
  }

  const rowMap = new Map(assetRows.map((r) => [r.assetId, r]));

  // Agrupamento por classe e setor
  const assetsByClass = new Map<string, PortfolioAsset[]>();
  const assetsByClassAndSector = new Map<string, Map<string, PortfolioAsset[]>>();

  for (const asset of assets) {
    const classKey = asset.asset_class ?? "Ações";
    const sectorKey = asset.sector?.trim() || inferSectorFromTicker(asset.ticker, classKey);

    const classList = assetsByClass.get(classKey) ?? [];
    classList.push(asset);
    assetsByClass.set(classKey, classList);

    let sectorMap = assetsByClassAndSector.get(classKey);
    if (!sectorMap) {
      sectorMap = new Map<string, PortfolioAsset[]>();
      assetsByClassAndSector.set(classKey, sectorMap);
    }
    const sectorList = sectorMap.get(sectorKey) ?? [];
    sectorList.push(asset);
    sectorMap.set(sectorKey, sectorList);
  }

  // Resolução de metas efetivas hierárquicas (Classe -> Setor -> Ativo)
  const effectiveTargetMap = new Map<string, number>();
  const hasIndividualTargets = targets.length > 0;

  // 1. Metas individuais explícitas (incluindo 0% e ativos não listados quando há metas individuais)
  for (const asset of assets) {
    if (targetMap.has(asset.id)) {
      effectiveTargetMap.set(asset.id, targetMap.get(asset.id)!);
    } else if (hasIndividualTargets) {
      effectiveTargetMap.set(asset.id, 0);
    }
  }

  // 2. Metas de setor e classe em 3 níveis
  for (const [className, sectorMap] of assetsByClassAndSector) {
    const normClass = normalizeClassName(className);
    const classTargetPct = classTargetMap.get(normClass) ?? 0;
    if (!(classTargetPct > 0)) continue;

    const sectorsWithTarget = sectorTargetMap.get(normClass);
    const hasConfiguredSectorTargets = sectorsWithTarget && sectorsWithTarget.size > 0;

    if (hasConfiguredSectorTargets) {
      for (const [sectorName, members] of sectorMap) {
        const sectorTargetInClass = sectorsWithTarget?.get(sectorName);

        if (sectorTargetInClass === 0) {
          for (const member of members) {
            if (!effectiveTargetMap.has(member.id)) {
              effectiveTargetMap.set(member.id, 0);
            }
          }
          continue;
        }

        if (!sectorTargetInClass || !(sectorTargetInClass > 0)) continue;

        const sectorEffectiveTargetPct = (classTargetPct * sectorTargetInClass) / 100;
        const unassigned = members.filter((a) => !effectiveTargetMap.has(a.id));
        if (unassigned.length === 0) continue;

        const assignedSum = members
          .filter((a) => effectiveTargetMap.has(a.id))
          .reduce((acc, a) => acc + (effectiveTargetMap.get(a.id) ?? 0), 0);

        const remainingSectorPct = Math.max(0, sectorEffectiveTargetPct - assignedSum);
        if (remainingSectorPct > 0) {
          const share = remainingSectorPct / unassigned.length;
          for (const member of unassigned) {
            effectiveTargetMap.set(member.id, share);
          }
        }
      }
    }

    // Fallback de classe para membros sem meta
    const classMembers = assetsByClass.get(className) ?? [];
    const remainingUnassigned = classMembers.filter((a) => !effectiveTargetMap.has(a.id));
    if (remainingUnassigned.length > 0) {
      const assignedClassSum = classMembers
        .filter((a) => effectiveTargetMap.has(a.id))
        .reduce((acc, a) => acc + (effectiveTargetMap.get(a.id) ?? 0), 0);

      const remainingClassPct = Math.max(0, classTargetPct - assignedClassSum);
      if (remainingClassPct > 0) {
        const share = remainingClassPct / remainingUnassigned.length;
        for (const member of remainingUnassigned) {
          effectiveTargetMap.set(member.id, share);
        }
      }
    }
  }

  // Estatísticas macro por classe para ordenação hierárquica
  const classDeficitMap = new Map<string, number>();
  for (const [className, members] of assetsByClass) {
    const normClass = normalizeClassName(className);
    const classTargetPct = classTargetMap.get(normClass) ?? 0;
    const classTargetValueBRL = (totalPortfolioBRL * classTargetPct) / 100;
    const classCurrentValueBRL = members.reduce((acc, a) => acc + (rowMap.get(a.id)?.valueBRL ?? 0), 0);

    const deficitRel =
      classTargetValueBRL > 0
        ? Math.max(0, (classTargetValueBRL - classCurrentValueBRL) / classTargetValueBRL)
        : 0;
    classDeficitMap.set(className, deficitRel);
  }

  interface SuggestionWithPriority extends AporteSuggestionItem {
    classDeficitRel: number;
  }

  const suggestions: SuggestionWithPriority[] = [];

  for (const asset of assets) {
    const targetPct = effectiveTargetMap.get(asset.id);
    if (!targetPct || targetPct <= 0) continue;

    const className = asset.asset_class ?? "Ações";
    const normClass = normalizeClassName(className);
    const hasClassTarget = (classTargetMap.get(normClass) ?? 0) > 0;
    const classDeficit = classDeficitMap.get(className) ?? 0;

    // Trava Hierárquica Estrita: se a classe possui meta definida e já atingiu/superou o alvo, nenhum membro da classe recebe recomendação
    if (hasClassTarget && classDeficit <= 0) {
      continue;
    }

    const row = rowMap.get(asset.id);
    const currentValueBRL = row?.valueBRL ?? 0;
    const currentPct = row?.pct ?? 0;
    const targetValueBRL = (totalPortfolioBRL * targetPct) / 100;
    const gapBRL = targetValueBRL - currentValueBRL;

    if (gapBRL > 0) {
      const sector = asset.sector ?? row?.sector ?? inferSectorFromTicker(asset.ticker, className);
      suggestions.push({
        assetId: asset.id,
        ticker: cleanTicker(asset.ticker),
        assetClass: className,
        sector,
        currentValueBRL,
        targetValueBRL,
        gapBRL: Math.round(gapBRL * 100) / 100,
        targetPercentage: targetPct,
        currentPercentage: currentPct,
        classDeficitRel: classDeficit,
      });
    }
  }

  return suggestions
    .sort((a, b) => {
      if (Math.abs(b.classDeficitRel - a.classDeficitRel) > 0.001) {
        return b.classDeficitRel - a.classDeficitRel;
      }
      return b.gapBRL - a.gapBRL;
    })
    .slice(0, limit)
    .map((item) => ({
      assetId: item.assetId,
      ticker: item.ticker,
      assetClass: item.assetClass,
      sector: item.sector,
      currentValueBRL: item.currentValueBRL,
      targetValueBRL: item.targetValueBRL,
      gapBRL: item.gapBRL,
      targetPercentage: item.targetPercentage,
      currentPercentage: item.currentPercentage,
    }));
}

/**
 * Retorna os ativos que possuem metas definidas, ordenados pela lógica hierárquica
 * (classe mais defasada -> maior gap de aporte), no formato TickerSearchResult.
 * Usado na lista "recomendados" do wizard quando não há busca ativa.
 */
export function buildTopSuggestionResults(
  assets: readonly PortfolioAsset[],
  assetRows: readonly {
    assetId: string;
    ticker: string;
    valueBRL: number;
    pct: number;
    assetClass?: string | null;
    sector?: string | null;
  }[],
  targets: readonly { asset_id: string; target_percentage: number }[],
  totalPortfolioBRL: number,
  limit = 5,
  classTargets?: readonly { name: string; target_percentage: number }[],
  sectorTargets?: readonly { className: string; sectorName: string; target_percentage: number }[],
): TickerSearchResult[] {
  const hasTargets = targets.length > 0 || (classTargets && classTargets.length > 0) || (sectorTargets && sectorTargets.length > 0);
  if (!hasTargets) return [];

  const suggestions = buildAporteSuggestions(assets, assetRows, targets, totalPortfolioBRL, limit, classTargets, sectorTargets);

  return suggestions.map((item) => {
    const asset = assets.find((a) => a.id === item.assetId);
    const catalogMatch = CURATED_TICKERS_CATALOG.find((c) => c.ticker === item.ticker);
    return {
      ticker: item.ticker,
      name: catalogMatch?.name ?? asset?.notes ?? item.ticker,
      assetClass: item.assetClass,
      sector: item.sector ?? asset?.sector ?? catalogMatch?.sector,
      currency: asset?.currency ?? catalogMatch?.currency ?? "BRL",
      isExisting: true,
      existingAssetId: item.assetId,
      currentQuantity: asset?.quantity,
      currentAveragePrice: asset?.average_price,
    };
  });
}

