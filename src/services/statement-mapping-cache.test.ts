import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllColumnMappingCache,
  computeHeaderSignature,
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
});
