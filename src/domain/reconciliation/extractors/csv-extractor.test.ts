import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsvToRows } from "./csv-extractor";

describe("csv-parser — Blindagem RFC-4180 e Delimitador BRL (Itens #13 e #14)", () => {
  it("escolhe ';' sobre ',' quando há vírgulas decimais (120,50) e vírgulas dentro de aspas", () => {
    const csv = [
      "Data;Estabelecimento;Valor",
      '10/11/2026;"Restaurante Silva, Filhos & Cia, Ltda";120,50',
      '11/11/2026;"Mercado Bom Preco, Loja 2";89,90',
      '12/11/2026;"Farmacia Popular, Centro, SP";45,25',
    ].join("\n");

    expect(detectDelimiter(csv)).toBe(";");

    const rows = parseCsvToRows(csv);
    expect(rows).toHaveLength(4);
    expect(rows[1]?.cells).toEqual([
      "10/11/2026",
      "Restaurante Silva, Filhos & Cia, Ltda",
      "120,50",
    ]);
    expect(rows[3]?.cells).toEqual([
      "12/11/2026",
      "Farmacia Popular, Centro, SP",
      "45,25",
    ]);
  });

  it("preserva quebras de linha dentro de campos entre aspas duplas (RFC-4180)", () => {
    const csv = [
      "Data;Descricao;Valor",
      '15/11/2026;"Compra Online\nParcela 01/03\nLoja Virtual";350,00',
      '16/11/2026;"Cafe ""Especial""\nCentro";18,50',
    ].join("\n");

    const rows = parseCsvToRows(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]?.cells).toEqual([
      "15/11/2026",
      "Compra Online Parcela 01/03 Loja Virtual",
      "350,00",
    ]);
    expect(rows[2]?.cells).toEqual([
      "16/11/2026",
      'Cafe "Especial" Centro',
      "18,50",
    ]);
  });

  it("remove automaticamente a diretiva sep=; na linha 1 (Excel) e usa o delimitador declarado", () => {
    const csv = [
      "sep=;",
      "Data;Lancamento;Valor",
      "01/11/2026;Padaria Central;32,90",
      "02/11/2026;Uber Viagem;24,50",
    ].join("\n");

    const rows = parseCsvToRows(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.cells).toEqual(["Data", "Lancamento", "Valor"]);
    expect(rows[1]?.cells).toEqual(["01/11/2026", "Padaria Central", "32,90"]);
  });

  it("suporta delimitador TAB mesmo com valores decimais com vírgula", () => {
    const tsv = [
      "Data\tDescricao\tValor",
      "10/11/2026\tSupermercado, Matriz\t145,80",
      "11/11/2026\tPosto Shell, Av Paulista\t210,00",
    ].join("\n");

    expect(detectDelimiter(tsv)).toBe("\t");
    const rows = parseCsvToRows(tsv);
    expect(rows).toHaveLength(3);
    expect(rows[1]?.cells).toEqual(["10/11/2026", "Supermercado, Matriz", "145,80"]);
  });
});
