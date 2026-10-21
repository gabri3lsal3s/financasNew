import { describe, expect, it } from "vitest";
import {
  CANONICAL_MERCHANT_CATALOG,
  cleanAcquirerPrefixes,
  findCanonicalMerchant,
} from "./merchant-catalog";

describe("merchant-catalog — cleanAcquirerPrefixes (Higienização Especializada de Adquirentes)", () => {
  it("remove prefixos comuns de maquininhas e adquirentes com asterisco", () => {
    expect(cleanAcquirerPrefixes("PAG*Padaria Estrela")).toBe("Padaria Estrela");
    expect(cleanAcquirerPrefixes("PAGSEGURO*Boutique Bela")).toBe("Boutique Bela");
    expect(cleanAcquirerPrefixes("PAGBANK*Mercadinho Central")).toBe("Mercadinho Central");
    expect(cleanAcquirerPrefixes("MP*Livraria Saraiva")).toBe("Livraria Saraiva");
    expect(cleanAcquirerPrefixes("MERCADOPAGO*Doces e Sabores")).toBe("Doces e Sabores");
    expect(cleanAcquirerPrefixes("STONE*Restaurante Central")).toBe("Restaurante Central");
    expect(cleanAcquirerPrefixes("TON*Floricultura Florescer")).toBe("Floricultura Florescer");
    expect(cleanAcquirerPrefixes("CIELO*Farmacia Vida")).toBe("Farmacia Vida");
    expect(cleanAcquirerPrefixes("REDECARD*Sapataria Conforto")).toBe("Sapataria Conforto");
    expect(cleanAcquirerPrefixes("REDE*Supermercado Popular")).toBe("Supermercado Popular");
    expect(cleanAcquirerPrefixes("GETNET*Barbearia Vintage")).toBe("Barbearia Vintage");
    expect(cleanAcquirerPrefixes("SUMUP*Acai Mania")).toBe("Acai Mania");
    expect(cleanAcquirerPrefixes("SAFRAPAY*Armazem da Prata")).toBe("Armazem da Prata");
    expect(cleanAcquirerPrefixes("INFINITEPAY*Chaveiro 24h")).toBe("Chaveiro 24h");
    expect(cleanAcquirerPrefixes("BIN*Auto Pecas Norte")).toBe("Auto Pecas Norte");
  });

  it("remove prefixos de adquirentes com separadores traço ou ponto", () => {
    expect(cleanAcquirerPrefixes("PAG - Padaria Estrela")).toBe("Padaria Estrela");
    expect(cleanAcquirerPrefixes("STONE.Restaurante Bom Sabor")).toBe("Restaurante Bom Sabor");
    expect(cleanAcquirerPrefixes("CIELO: Farmacia Central")).toBe("Farmacia Central");
  });

  it("normaliza casos especiais de mobilidade e delivery (Uber e iFood)", () => {
    expect(cleanAcquirerPrefixes("UBER *TRIP HELP")).toBe("Uber");
    expect(cleanAcquirerPrefixes("UBER *TRIP")).toBe("Uber");
    expect(cleanAcquirerPrefixes("UBER *EATS")).toBe("Uber Eats");
    expect(cleanAcquirerPrefixes("UBER")).toBe("Uber");
    expect(cleanAcquirerPrefixes("UBER *RESTAURANTE SABOR")).toBe("RESTAURANTE SABOR");

    expect(cleanAcquirerPrefixes("IFOOD *PEDIDO")).toBe("iFood");
    expect(cleanAcquirerPrefixes("IFOOD *ENTREGA")).toBe("iFood");
    expect(cleanAcquirerPrefixes("IFOOD *RESTAURANTE SABOR")).toBe("RESTAURANTE SABOR");
    expect(cleanAcquirerPrefixes("IFOOD *MCDONALDS")).toBe("MCDONALDS");
    expect(cleanAcquirerPrefixes("IFOOD")).toBe("iFood");

    expect(cleanAcquirerPrefixes("99APP *99POP")).toBe("99");
    expect(cleanAcquirerPrefixes("99 *PANIFICADORA ALVORADA")).toBe("PANIFICADORA ALVORADA");
    expect(cleanAcquirerPrefixes("MP*MERCADOLIVRE")).toBe("Mercado Livre");
    expect(cleanAcquirerPrefixes("MERCADOLIVRE.COM")).toBe("Mercado Livre");
  });

  it("remove prefixos operacionais bancários e de autorização", () => {
    expect(cleanAcquirerPrefixes("COMPRA APROVADA - Padaria Estrela POS 12345")).toBe("Padaria Estrela");
    expect(cleanAcquirerPrefixes("COMPRA NO DEBITO Padaria Central")).toBe("Padaria Central");
    expect(cleanAcquirerPrefixes("COMPRA NO CREDITO A VISTA - Drogaria Raia")).toBe("Drogaria Raia");
    expect(cleanAcquirerPrefixes("PAGTO ELETRON COBRANCA MERCADO CENTRAL 14/05")).toBe("MERCADO CENTRAL");
    expect(cleanAcquirerPrefixes("TRANSFERENCIA PIX PARA Maria Santos")).toBe("Maria Santos");
    expect(cleanAcquirerPrefixes("ENVIO PIX - Carlos Oliveira")).toBe("Carlos Oliveira");
    expect(cleanAcquirerPrefixes("PAGAMENTO DE TITULO - Condominio Edificio")).toBe("Condominio Edificio");
    expect(cleanAcquirerPrefixes("DEBITO ELO Supermercado Extra")).toBe("Supermercado Extra");
  });

  it("elimina resíduos de terminais POS, NSU, DOC, AUT e carimbos de data/hora", () => {
    expect(cleanAcquirerPrefixes("Posto Ipiranga TERM 998811 12/03")).toBe("Posto Ipiranga");
    expect(cleanAcquirerPrefixes("Drogaria Pacheco NSU 102938 AUT 4499")).toBe("Drogaria Pacheco");
    expect(cleanAcquirerPrefixes("Lanchonete Silva 14:30:00")).toBe("Lanchonete Silva");
  });

  it("elimina sufixos de geolocalização e siglas de UF", () => {
    expect(cleanAcquirerPrefixes("DROGASIL SAO PAULO BR")).toBe("DROGASIL");
    expect(cleanAcquirerPrefixes("POSTO IPIRANGA RIO DE JANEI BRA")).toBe("POSTO IPIRANGA");
    expect(cleanAcquirerPrefixes("CARREFOUR HIPER SAO PAULO SP")).toBe("CARREFOUR HIPER");
    expect(cleanAcquirerPrefixes("FARMACIA PANVEL CURITIBA PR")).toBe("FARMACIA PANVEL");
    expect(cleanAcquirerPrefixes("SUPERMERCADO BH BELO HORIZONTE MG")).toBe("SUPERMERCADO BH");
  });

  it("elimina resíduos de dados de cartões, bandeiras e carteiras", () => {
    expect(cleanAcquirerPrefixes("POSTO IPIRANGA, cartao final 1234")).toBe("POSTO IPIRANGA");
    expect(cleanAcquirerPrefixes("LOJA XYZ - final 5678")).toBe("LOJA XYZ");
    expect(cleanAcquirerPrefixes("Restaurante do Zé com cartao nubank final 4321")).toBe("Restaurante do Zé");
    expect(cleanAcquirerPrefixes("Farmacia Raia no cartao visa final 0011")).toBe("Farmacia Raia");
    expect(cleanAcquirerPrefixes("Posto Shell via cartao mastercard final 7788")).toBe("Posto Shell");
  });

  it("trata strings vazias ou sem ruídos sem corromper o texto", () => {
    expect(cleanAcquirerPrefixes("")).toBe("");
    expect(cleanAcquirerPrefixes("   ")).toBe("");
    expect(cleanAcquirerPrefixes("Padaria Flor de Trigo")).toBe("Padaria Flor de Trigo");
  });
});

describe("merchant-catalog — CANONICAL_MERCHANT_CATALOG e findCanonicalMerchant", () => {
  it("embarca mais de 100 marcas e redes canônicas no Brasil", () => {
    expect(CANONICAL_MERCHANT_CATALOG.length).toBeGreaterThanOrEqual(100);
  });

  it("cobre todos os segmentos essenciais do mercado brasileiro", () => {
    const categories = new Set(CANONICAL_MERCHANT_CATALOG.map((m) => m.categorySlug));
    expect(categories).toContain("mercado");
    expect(categories).toContain("saude");
    expect(categories).toContain("transporte");
    expect(categories).toContain("assinaturas");
    expect(categories).toContain("moradia");
    expect(categories).toContain("compras");
    expect(categories).toContain("alimentacao");
  });

  it("findCanonicalMerchant identifica estabelecimento por CNPJ cadastrado", () => {
    const mcDonalds = findCanonicalMerchant("42591651000143");
    expect(mcDonalds).toBeDefined();
    expect(mcDonalds?.friendlyName).toBe("McDonald's");
    expect(mcDonalds?.categorySlug).toBe("alimentacao");

    const carrefour = findCanonicalMerchant("45.543.915/0001-81");
    expect(carrefour).toBeDefined();
    expect(carrefour?.friendlyName).toBe("Carrefour");
    expect(carrefour?.categorySlug).toBe("mercado");

    const drogasil = findCanonicalMerchant("61585865000139");
    expect(drogasil).toBeDefined();
    expect(drogasil?.friendlyName).toBe("Drogasil");
    expect(drogasil?.categorySlug).toBe("saude");
  });

  it("findCanonicalMerchant identifica concessionárias públicas e serviços essenciais", () => {
    const enel = findCanonicalMerchant("Enel Distribuição São Paulo");
    expect(enel).toBeDefined();
    expect(enel?.friendlyName).toBe("Enel");
    expect(enel?.categorySlug).toBe("moradia");

    const sabesp = findCanonicalMerchant("Cia de Saneamento Basico Sabesp");
    expect(sabesp).toBeDefined();
    expect(sabesp?.friendlyName).toBe("Sabesp");
    expect(sabesp?.categorySlug).toBe("moradia");

    const cpfl = findCanonicalMerchant("CPFL Paulista Energia");
    expect(cpfl).toBeDefined();
    expect(cpfl?.friendlyName).toBe("CPFL Energia");
    expect(cpfl?.categorySlug).toBe("moradia");

    const copasa = findCanonicalMerchant("Copasa MG Fatura");
    expect(copasa).toBeDefined();
    expect(copasa?.friendlyName).toBe("Copasa");
    expect(copasa?.categorySlug).toBe("moradia");
  });

  it("findCanonicalMerchant identifica streamings e assinaturas digitais", () => {
    const netflix = findCanonicalMerchant("Netflix.com Entretenimento");
    expect(netflix?.friendlyName).toBe("Netflix");
    expect(netflix?.categorySlug).toBe("assinaturas");

    const spotify = findCanonicalMerchant("Spotify Premium Mensal");
    expect(spotify?.friendlyName).toBe("Spotify");
    expect(spotify?.categorySlug).toBe("assinaturas");

    const amazonPrime = findCanonicalMerchant("Prime Video Brasil");
    expect(amazonPrime?.friendlyName).toBe("Amazon Prime");
    expect(amazonPrime?.categorySlug).toBe("assinaturas");

    const chatGpt = findCanonicalMerchant("ChatGPT Subscription OpenAI");
    expect(chatGpt?.friendlyName).toBe("OpenAI / ChatGPT");
    expect(chatGpt?.categorySlug).toBe("assinaturas");
  });

  it("findCanonicalMerchant identifica supermercados e redes de atacado", () => {
    const paoDeAcucar = findCanonicalMerchant("Minuto Pão de Açúcar Loja 12");
    expect(paoDeAcucar?.friendlyName).toBe("Pão de Açúcar");
    expect(paoDeAcucar?.categorySlug).toBe("mercado");

    const assai = findCanonicalMerchant("Assaí Atacadista Filial");
    expect(assai?.friendlyName).toBe("Assaí Atacadista");
    expect(assai?.categorySlug).toBe("mercado");

    const atacadao = findCanonicalMerchant("Atacadão Distribuição");
    expect(atacadao?.friendlyName).toBe("Atacadão");
    expect(atacadao?.categorySlug).toBe("mercado");
  });

  it("findCanonicalMerchant identifica postos de combustível e tags de pedágio", () => {
    const ipiranga = findCanonicalMerchant("Auto Posto Ipiranga");
    expect(ipiranga?.friendlyName).toBe("Posto Ipiranga");
    expect(ipiranga?.categorySlug).toBe("transporte");

    const shell = findCanonicalMerchant("Raízen Posto Shell");
    expect(shell?.friendlyName).toBe("Posto Shell");
    expect(shell?.categorySlug).toBe("transporte");

    const semParar = findCanonicalMerchant("Sem Parar Pedágio");
    expect(semParar?.friendlyName).toBe("Sem Parar");
    expect(semParar?.categorySlug).toBe("transporte");
  });

  it("findCanonicalMerchant identifica redes de varejo, moda e alimentação rápida", () => {
    const renner = findCanonicalMerchant("Lojas Renner Shopping Morumbi");
    expect(renner?.friendlyName).toBe("Lojas Renner");
    expect(renner?.categorySlug).toBe("compras");

    const magalu = findCanonicalMerchant("Magazine Luiza Loja 45");
    expect(magalu?.friendlyName).toBe("Magazine Luiza");
    expect(magalu?.categorySlug).toBe("compras");

    const outback = findCanonicalMerchant("Outback Steakhouse");
    expect(outback?.friendlyName).toBe("Outback Steakhouse");
    expect(outback?.categorySlug).toBe("alimentacao");

    const smartFit = findCanonicalMerchant("Smart Fit Academia");
    expect(smartFit?.friendlyName).toBe("Smart Fit");
    expect(smartFit?.categorySlug).toBe("saude");
  });

  it("retorna undefined para nomes de terceiros não cadastrados ou textos vazios", () => {
    expect(findCanonicalMerchant("")).toBeUndefined();
    expect(findCanonicalMerchant("   ")).toBeUndefined();
    expect(findCanonicalMerchant("Empresa Xpto Tecnologia Ltda")).toBeUndefined();
    expect(findCanonicalMerchant("Transferencia Pix Enviada")).toBeUndefined();
  });
});
