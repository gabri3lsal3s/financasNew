import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllColumnMappingCache,
  computeHeaderSignature,
  extractHeaderCellsForCache,
  getCachedColumnMapping,
  setCachedColumnMapping,
  validateMappingAgainstSample,
} from "./statement-mapping-cache";
import type { ColumnMapping, RawParsedRow } from "@/domain/reconciliation/types";

describe("statement-mapping-cache — Cache Declarativo de Mapeamento com Fallback Defensivo", () => {
  beforeEach(() => {
    clearAllColumnMappingCache();
  });

  const validHeader = ["Data", "Descrição", "Valor"];
  const standardMapping: ColumnMapping = {
    dateColIndex: 0,
    descriptionColIndex: 1,
    amountColIndex: 2,
    hasHeader: true,
    startRowIndex: 1,
  };

  it("normaliza cabeçalhos gerando assinaturas determinísticas insensíveis a maiúsculas e pontuação", () => {
    const sig1 = computeHeaderSignature(["Data", "Descrição", "Valor (R$)"]);
    const sig2 = computeHeaderSignature(["DATA", "descrição", "valor_r$"]);
    expect(sig1).toBe(sig2);
  });

  it("retorna hit de cache para cabeçalhos previamente salvos", () => {
    setCachedColumnMapping(validHeader, standardMapping);

    const hit = getCachedColumnMapping(["data", "descricao", "valor"]);
    expect(hit).toEqual(standardMapping);
  });

  it("retorna null (miss) para cabeçalhos nunca mapeados", () => {
    const miss = getCachedColumnMapping(["Data", "Categoria", "Conta", "Saldo"]);
    expect(miss).toBeNull();
  });

  describe("Fallback Defensivo", () => {
    it("invalida o cache e retorna null se os índices excederem o número de colunas das linhas atuais", () => {
      // Mapeamento que espera 4 colunas (amountColIndex = 3)
      const fourColMapping: ColumnMapping = {
        dateColIndex: 0,
        descriptionColIndex: 1,
        amountColIndex: 3,
        hasHeader: true,
        startRowIndex: 1,
      };

      setCachedColumnMapping(validHeader, fourColMapping);

      // Linhas atuais têm apenas 3 colunas (índices 0, 1, 2)
      const sampleRowsNarrow: RawParsedRow[] = [
        { rowIndex: 0, rawText: "Data;Desc;Valor", cells: ["Data", "Desc", "Valor"] },
        { rowIndex: 1, rawText: "10/05/2026;Posto;100,00", cells: ["10/05/2026", "Posto", "100,00"] },
      ];

      const fallback = getCachedColumnMapping(validHeader, sampleRowsNarrow);
      expect(fallback).toBeNull();

      // Confirma que o cache corrompido foi invalidado do storage
      expect(getCachedColumnMapping(validHeader)).toBeNull();
    });

    it("invalida o cache e retorna null se menos de 50% das linhas amostradas contiverem data e valor válidos", () => {
      // Mapeamento que troca Data por Descrição (dateColIndex = 1)
      const invertedMapping: ColumnMapping = {
        dateColIndex: 1,
        descriptionColIndex: 0,
        amountColIndex: 2,
        hasHeader: true,
        startRowIndex: 1,
      };

      setCachedColumnMapping(validHeader, invertedMapping);

      // Linhas com texto na coluna 1 (não é data)
      const sampleRows: RawParsedRow[] = [
        { rowIndex: 0, rawText: "Data;Desc;Valor", cells: ["Data", "Desc", "Valor"] },
        { rowIndex: 1, rawText: "10/05/2026;Padaria Estrela;25,00", cells: ["10/05/2026", "Padaria Estrela", "25,00"] },
        { rowIndex: 2, rawText: "12/05/2026;Farmacia Central;40,00", cells: ["12/05/2026", "Farmacia Central", "40,00"] },
      ];

      const fallback = getCachedColumnMapping(validHeader, sampleRows);
      expect(fallback).toBeNull();
    });

    it("valida com sucesso quando a amostra satisfaz os índices de data e valor", () => {
      const sampleRowsValid: RawParsedRow[] = [
        { rowIndex: 0, rawText: "Data;Desc;Valor", cells: ["Data", "Desc", "Valor"] },
        { rowIndex: 1, rawText: "10/05/2026;Padaria Estrela;25,00", cells: ["10/05/2026", "Padaria Estrela", "25,00"] },
        { rowIndex: 2, rawText: "12/05/2026;Farmacia Central;40,00", cells: ["12/05/2026", "Farmacia Central", "40,00"] },
      ];

      expect(validateMappingAgainstSample(standardMapping, sampleRowsValid)).toBe(true);
    });
  });

  it("limpa todo o cache via clearAllColumnMappingCache", () => {
    setCachedColumnMapping(["Data", "Valor"], standardMapping);
    clearAllColumnMappingCache();
    expect(getCachedColumnMapping(["Data", "Valor"])).toBeNull();
  });

  describe("Blindagens Fase 1B — Cabeçalho Real e Colunas Duplas (Itens #15 e #16)", () => {
    it("extrai a linha real de cabeçalho (startRowIndex - 1) ignorando preâmbulo bancário com mês (#15)", () => {
      const rowsWithPreamble: RawParsedRow[] = [
        { rowIndex: 0, rawText: "Banco XYZ - Extrato Novembro/2026", cells: ["Banco XYZ - Extrato Novembro/2026"] },
        { rowIndex: 1, rawText: "Cartao Final 2107", cells: ["Cartao Final 2107"] },
        { rowIndex: 2, rawText: "Data;Estabelecimento;Valor", cells: ["Data", "Estabelecimento", "Valor"] },
        { rowIndex: 3, rawText: "10/11/2026;Padaria;25,00", cells: ["10/11/2026", "Padaria", "25,00"] },
      ];

      const mappingWithPreamble: ColumnMapping = {
        dateColIndex: 0,
        descriptionColIndex: 1,
        amountColIndex: 2,
        hasHeader: true,
        startRowIndex: 3,
      };

      expect(extractHeaderCellsForCache(rowsWithPreamble, mappingWithPreamble)).toEqual([
        "Data",
        "Estabelecimento",
        "Valor",
      ]);
    });

    it("retorna [] com guarda segura para CSVs sem cabeçalho (startRowIndex === 0) sem acessar rows[-1] (#15)", () => {
      const headerlessRows: RawParsedRow[] = [
        { rowIndex: 0, rawText: "10/11/2026;Padaria;25,00", cells: ["10/11/2026", "Padaria", "25,00"] },
      ];

      const headerlessMapping: ColumnMapping = {
        dateColIndex: 0,
        descriptionColIndex: 1,
        amountColIndex: 2,
        hasHeader: false,
        startRowIndex: 0,
      };
      expect(extractHeaderCellsForCache(headerlessRows, headerlessMapping)).toEqual([]);

      // Mesmo se hasHeader fosse inconsistente com startRowIndex === 0, guarda headerRowIndex >= 0 protege
      const inconsistentMapping: ColumnMapping = {
        ...headerlessMapping,
        hasHeader: true,
        startRowIndex: 0,
      };
      expect(extractHeaderCellsForCache(headerlessRows, inconsistentMapping)).toEqual([]);
    });

    it("valida planilhas com colunas separadas de Débito e Crédito em validateMappingAgainstSample (#16)", () => {
      const dualColMapping: ColumnMapping = {
        dateColIndex: 0,
        descriptionColIndex: 1,
        amountColIndex: 2,
        debitColIndex: 2,
        creditColIndex: 3,
        hasHeader: true,
        startRowIndex: 1,
      };

      const dualRows: RawParsedRow[] = [
        { rowIndex: 0, rawText: "Data;Histórico;Débito;Crédito", cells: ["Data", "Histórico", "Débito", "Crédito"] },
        { rowIndex: 1, rawText: "10/11/2026;Estorno Loja;;120,00", cells: ["10/11/2026", "Estorno Loja", "", "120,00"] },
        { rowIndex: 2, rawText: "11/11/2026;Pagamento Fatura;;500,00", cells: ["11/11/2026", "Pagamento Fatura", "", "500,00"] },
        { rowIndex: 3, rawText: "12/11/2026;Mercado;85,50;", cells: ["12/11/2026", "Mercado", "85,50", ""] },
      ];

      expect(validateMappingAgainstSample(dualColMapping, dualRows)).toBe(true);
    });

    it("rejeita mapeamento corrompido onde descriptionColIndex === dateColIndex (#16)", () => {
      const poisonedMapping: ColumnMapping = {
        dateColIndex: 0,
        descriptionColIndex: 0,
        amountColIndex: 2,
        hasHeader: true,
        startRowIndex: 1,
      };

      const rows: RawParsedRow[] = [
        { rowIndex: 0, rawText: "Data;Desc;Valor", cells: ["Data", "Desc", "Valor"] },
        { rowIndex: 1, rawText: "10/11/2026;Padaria;25,00", cells: ["10/11/2026", "Padaria", "25,00"] },
      ];

      expect(validateMappingAgainstSample(poisonedMapping, rows)).toBe(false);
    });
  });
});
