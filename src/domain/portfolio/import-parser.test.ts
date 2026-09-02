import { describe, expect, it } from "vitest";
import {
  detectPortfolioColumns,
  extractTickerFromText,
  inferAssetClassFromTicker,
  parseInvestmentCsv,
  parseNaturalInvestmentLine,
  parsePortfolioFromMapping,
  parsePortfolioInput,
} from "./import-parser";

describe("domain/portfolio/import-parser — Fase 35 & 36", () => {
  describe("inferAssetClassFromTicker", () => {
    it("identifica ações da B3", () => {
      expect(inferAssetClassFromTicker("PETR4")).toBe("Ações");
      expect(inferAssetClassFromTicker("VALE3")).toBe("Ações");
      expect(inferAssetClassFromTicker("ITUB4")).toBe("Ações");
      expect(inferAssetClassFromTicker("TAEE11")).toBe("FIIs"); // 11 cai em FIIs/Units
    });

    it("identifica FIIs", () => {
      expect(inferAssetClassFromTicker("MXRF11")).toBe("FIIs");
      expect(inferAssetClassFromTicker("HGLG11")).toBe("FIIs");
      expect(inferAssetClassFromTicker("KNIP11")).toBe("FIIs");
    });

    it("identifica BDRs", () => {
      expect(inferAssetClassFromTicker("AAPL34")).toBe("BDRs");
      expect(inferAssetClassFromTicker("MSFT34")).toBe("BDRs");
      expect(inferAssetClassFromTicker("NVDC34")).toBe("BDRs");
    });

    it("identifica Ativos Internacionais", () => {
      expect(inferAssetClassFromTicker("AAPL")).toBe("Internacional");
      expect(inferAssetClassFromTicker("VOO")).toBe("Internacional");
      expect(inferAssetClassFromTicker("TSLA")).toBe("Internacional");
      expect(inferAssetClassFromTicker("O")).toBe("Internacional");
      expect(inferAssetClassFromTicker("T")).toBe("Internacional");
      expect(inferAssetClassFromTicker("V")).toBe("Internacional");
    });

    it("identifica Criptoativos", () => {
      expect(inferAssetClassFromTicker("BTC")).toBe("Cripto");
      expect(inferAssetClassFromTicker("ETH")).toBe("Cripto");
      expect(inferAssetClassFromTicker("SOL")).toBe("Cripto");
    });

    it("identifica Renda Fixa", () => {
      expect(inferAssetClassFromTicker("TESOURO_SELIC")).toBe("Renda Fixa");
      expect(inferAssetClassFromTicker("CDB_BANCO_INTER")).toBe("Renda Fixa");
    });
  });

  describe("extractTickerFromText — Resiliência B3 & Fracionário", () => {
    it("extrai e limpa ativos fracionários da B3 (PETR4F -> PETR4)", () => {
      const res = extractTickerFromText("PETR4F");
      expect(res?.ticker).toBe("PETR4");

      const resVale = extractTickerFromText("15/08 comprei 10 VALE3F a 60,00");
      expect(resVale?.ticker).toBe("VALE3");
    });

    it("extrai ticker de descrições longas de extratos da B3", () => {
      const res = extractTickerFromText("PETR4 - PETROLEO BRASILEIRO S.A.");
      expect(res?.ticker).toBe("PETR4");

      const resFii = extractTickerFromText("MXRF11 - MAXI RENDA FII");
      expect(resFii?.ticker).toBe("MXRF11");
    });
  });

  describe("parseNaturalInvestmentLine — Quick-Paste", () => {
    it("interpreta compra simples com data DD/MM, quantidade e preço", () => {
      const result = parseNaturalInvestmentLine("15/08 comprei 100 PETR4 a 38,50", 2026);
      expect(result).not.toBeNull();
      expect(result?.date).toBe("2026-08-15");
      expect(result?.ticker).toBe("PETR4");
      expect(result?.type).toBe("buy");
      expect(result?.quantity).toBe(100);
      expect(result?.price).toBe(38.5);
      expect(result?.total).toBe(3850);
      expect(result?.currency).toBe("BRL");
      expect(result?.assetClass).toBe("Ações");
    });

    it("interpreta provento de FII (rendimento)", () => {
      const result = parseNaturalInvestmentLine("recebi 45,80 de rendimento de MXRF11 hoje");
      expect(result).not.toBeNull();
      expect(result?.type).toBe("fii_yield");
      expect(result?.ticker).toBe("MXRF11");
      expect(result?.total).toBe(45.8);
      expect(result?.assetClass).toBe("FIIs");
    });

    it("interpreta JCP", () => {
      const result = parseNaturalInvestmentLine("20/07 recebi 120,50 de JCP de ITUB4", 2026);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("jcp");
      expect(result?.ticker).toBe("ITUB4");
      expect(result?.total).toBe(120.5);
    });

    it("interpreta ativo internacional em USD", () => {
      const result = parseNaturalInvestmentLine("10/07 comprei 5 AAPL a 220.50", 2026);
      expect(result).not.toBeNull();
      expect(result?.ticker).toBe("AAPL");
      expect(result?.currency).toBe("USD");
      expect(result?.assetClass).toBe("Internacional");
      expect(result?.quantity).toBe(5);
      expect(result?.price).toBe(220.5);
      expect(result?.total).toBe(1102.5);
    });

    it("interpreta ativo internacional de 1 letra (O - Realty Income, T - AT&T) sem colidir com artigos", () => {
      const resultO = parseNaturalInvestmentLine("10/07 compra de 10 cotas de O a 55.00", 2026);
      expect(resultO).not.toBeNull();
      expect(resultO?.ticker).toBe("O");
      expect(resultO?.currency).toBe("USD");
      expect(resultO?.quantity).toBe(10);
      expect(resultO?.price).toBe(55.0);

      const resultT = parseNaturalInvestmentLine("12/08 comprei 20 T a 18.25", 2026);
      expect(resultT).not.toBeNull();
      expect(resultT?.ticker).toBe("T");
      expect(resultT?.currency).toBe("USD");
      expect(resultT?.quantity).toBe(20);
    });

    it("interpreta split / desdobramento", () => {
      const result = parseNaturalInvestmentLine("01/06 desdobramento 2 para 1 em MGLU3", 2026);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("split");
      expect(result?.ticker).toBe("MGLU3");
      expect(result?.quantity).toBe(2);
    });
  });

  describe("detectPortfolioColumns & parsePortfolioFromMapping", () => {
    it("detecta automaticamente colunas de extrato B3 / Área do Investidor", () => {
      const b3Csv = `Data do Negócio;Tipo de Movimentação;Mercado;Código de Negociação;Quantidade;Preço;Valor Total
15/08/2026;Compra;Mercado à Vista;PETR4;100;38,50;3850,00
16/08/2026;Venda;Mercado à Vista;VALE3;50;60,00;3000,00`;

      const detection = detectPortfolioColumns(b3Csv);
      expect(detection.mapping.hasHeader).toBe(true);
      expect(detection.mapping.delimiter).toBe(";");
      expect(detection.mapping.dateColIndex).toBe(0);
      expect(detection.mapping.typeColIndex).toBe(1);
      expect(detection.mapping.tickerColIndex).toBe(3);
      expect(detection.mapping.qtyColIndex).toBe(4);
      expect(detection.mapping.priceColIndex).toBe(5);
      expect(detection.mapping.totalColIndex).toBe(6);

      const parsed = parsePortfolioFromMapping(detection.rows, detection.mapping, 2026);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.ticker).toBe("PETR4");
      expect(parsed[0]?.quantity).toBe(100);
      expect(parsed[0]?.price).toBe(38.5);
      expect(parsed[0]?.total).toBe(3850);
      expect(parsed[1]?.ticker).toBe("VALE3");
      expect(parsed[1]?.type).toBe("sell");
    });

    it("suporta extrato de Movimentação B3 com descrição de ativo e fracionário", () => {
      const b3Mov = `Data;Entrada/Saída;Movimentação;Código de Negociação;Quantidade;Preço unitário;Valor da Operação
10/08/2026;Credito;Transferência - Liquidação;PETR4F - PETROLEO BRASILEIRO;50;38,00;1900,00
12/08/2026;Credito;Rendimento;MXRF11 - MAXI RENDA FII;0;0;45,50`;

      const detection = detectPortfolioColumns(b3Mov);
      const parsed = parsePortfolioFromMapping(detection.rows, detection.mapping, 2026);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.ticker).toBe("PETR4"); // limpou o F e a descrição
      expect(parsed[0]?.type).toBe("buy");
      expect(parsed[0]?.quantity).toBe(50);
      expect(parsed[1]?.ticker).toBe("MXRF11");
      expect(parsed[1]?.type).toBe("fii_yield");
      expect(parsed[1]?.total).toBe(45.5);
    });
  });

  describe("parseInvestmentCsv — Planilhas B3 e Corretoras", () => {
    it("interpreta layout tabular B3 (ponto e vírgula com cabeçalho)", () => {
      const csv = `Data do Negócio;Tipo de Movimentação;Código de Negociação;Quantidade;Preço;Valor Total
15/08/2026;Compra;PETR4;100;38,50;3850,00
16/08/2026;Venda;VALE3;50;60,00;3000,00
18/08/2026;Rendimento;MXRF11;0;0;45,00`;

      const rows = parseInvestmentCsv(csv, 2026);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({
        date: "2026-08-15",
        ticker: "PETR4",
        type: "buy",
        quantity: 100,
        price: 38.5,
        total: 3850,
      });
      expect(rows[1]).toMatchObject({
        date: "2026-08-16",
        ticker: "VALE3",
        type: "sell",
        quantity: 50,
        price: 60,
        total: 3000,
      });
      expect(rows[2]).toMatchObject({
        date: "2026-08-18",
        ticker: "MXRF11",
        type: "fii_yield",
        total: 45,
      });
    });

    it("interpreta CSV com tabulação (copiado do Excel)", () => {
      const tsv = `Data\tTicker\tOperação\tQtd\tPreço\tTotal
2026-07-10\tAAPL\tCompra\t10\t200\t2000`;

      const rows = parseInvestmentCsv(tsv, 2026);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        date: "2026-07-10",
        ticker: "AAPL",
        type: "buy",
        quantity: 10,
        price: 200,
        total: 2000,
        currency: "USD",
      });
    });
  });

  describe("parsePortfolioInput — Unificado", () => {
    it("processa bloco misto de linguagem natural multilinhas", () => {
      const text = `15/08 comprei 100 PETR4 a 38,50
16/08 vendi 50 VALE3 a 61,00
17/08 recebi 150,00 de dividendo de BBAS3`;

      const rows = parsePortfolioInput(text, 2026);
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.ticker)).toEqual(["PETR4", "VALE3", "BBAS3"]);
      expect(rows.map((r) => r.type)).toEqual(["buy", "sell", "dividend"]);
    });

    it("interpreta lista de tickers puros para cadastro de ativos do zero sem movimentação inicial", () => {
      const text = `PETR4
VALE3
MXRF11
AAPL`;

      const rows = parsePortfolioInput(text, 2026);
      expect(rows).toHaveLength(4);
      expect(rows.map((r) => r.ticker)).toEqual(["PETR4", "VALE3", "MXRF11", "AAPL"]);
      expect(rows.every((r) => r.quantity === 0 && r.price === 0 && r.total === 0)).toBe(true);
      expect(rows[0]?.assetClass).toBe("Ações");
      expect(rows[2]?.assetClass).toBe("FIIs");
      expect(rows[3]?.currency).toBe("USD");
    });

    it("interpreta planilha de Posição Atual / Custódia da B3 e Corretoras", () => {
      const b3Posicao = `Código do Ativo;Empresa / Fundo;Quantidade Disponível;Preço Médio;Valor Aplicado;Última Cotação;Posição Atualizada
PETR4;PETROLEO BRASILEIRO S.A.;100;34,50;3450,00;38,00;3800,00
MXRF11;MAXI RENDA FII;500;10,20;5100,00;10,50;5250,00
IVVB11;ISHARES S&P 500 FDO;25;280,00;7000,00;310,00;7750,00
Total Geral;;625;;15550,00;;16800,00`;

      const detection = detectPortfolioColumns(b3Posicao);
      expect(detection.mapping.mode).toBe("positions");
      expect(detection.mapping.hasHeader).toBe(true);

      const parsed = parsePortfolioFromMapping(detection.rows, detection.mapping, 2026);
      expect(parsed).toHaveLength(3); // ignora o Total Geral que não tem ticker

      expect(parsed[0]).toMatchObject({
        ticker: "PETR4",
        type: "buy",
        quantity: 100,
        price: 34.5,
        total: 3450,
        assetClass: "Ações",
      });

      expect(parsed[1]).toMatchObject({
        ticker: "MXRF11",
        type: "buy",
        quantity: 500,
        price: 10.2,
        total: 5100,
        assetClass: "FIIs",
      });

      expect(parsed[2]).toMatchObject({
        ticker: "IVVB11",
        type: "buy",
        quantity: 25,
        price: 280,
        total: 7000,
        assetClass: "FIIs",
      });
    });

    it("retorna array vazio para entrada vazia ou em branco", () => {
      expect(parsePortfolioInput("")).toEqual([]);
      expect(parsePortfolioInput("   \n  \n ")).toEqual([]);
    });
  });
});

