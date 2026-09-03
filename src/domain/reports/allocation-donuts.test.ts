import { describe, expect, it } from "vitest";
import { buildAllocationDonutSegments } from "./allocation-donuts";

describe("buildAllocationDonutSegments — Distribuição por Classes e Setores", () => {
  it("calcula fatias proporcionais por classe e inclui o Caixa", () => {
    const positions = [
      { assetClass: "Ações", sector: "Financeiro", valueBRL: 4000 },
      { assetClass: "FIIs", sector: "Logística", valueBRL: 3000 },
      { assetClass: "Renda Fixa", sector: "Pós-fixado", valueBRL: 2000 },
    ];
    const cashBalanceBRL = 1000;

    const result = buildAllocationDonutSegments({
      positions,
      cashBalanceBRL,
      includeCash: true,
    });

    expect(result.totalBRL).toBe(10000);
    expect(result.classSegments).toHaveLength(4);

    // Classes ordenadas por valor decrescente
    expect(result.classSegments[0]).toMatchObject({
      label: "Ações",
      value: 4000,
      pct: 40,
    });
    expect(result.classSegments[1]).toMatchObject({
      label: "FIIs",
      value: 3000,
      pct: 30,
    });
    expect(result.classSegments[2]).toMatchObject({
      label: "Renda Fixa",
      value: 2000,
      pct: 20,
    });
    expect(result.classSegments[3]).toMatchObject({
      label: "Reserva de Caixa",
      value: 1000,
      pct: 10,
    });
  });

  it("aplica agrupamento de cauda longa quando houver mais de 6 setores ou fatias < 3%", () => {
    const positions = [
      { assetClass: "Ações", sector: "Financeiro", valueBRL: 4000 },
      { assetClass: "Ações", sector: "Energia Elétrica", valueBRL: 2000 },
      { assetClass: "FIIs", sector: "Logística", valueBRL: 1500 },
      { assetClass: "Ações", sector: "Tecnologia", valueBRL: 1000 },
      { assetClass: "Ações", sector: "Saneamento", valueBRL: 600 },
      { assetClass: "Ações", sector: "Saúde", valueBRL: 400 },
      // Setores pequenos (< 3% de 10.000 = 300):
      { assetClass: "Ações", sector: "Varejo", valueBRL: 200 },
      { assetClass: "Ações", sector: "Telecom", valueBRL: 150 },
      { assetClass: "Ações", sector: "Agronegócio", valueBRL: 150 },
    ];

    const result = buildAllocationDonutSegments({
      positions,
      cashBalanceBRL: 0,
      includeCash: false,
    });

    expect(result.totalBRL).toBe(10000);
    expect(result.totalUniqueSectors).toBe(9);

    // Deve conter os maiores setores + "Outros Setores"
    const labels = result.sectorSegments.map((s) => s.label);
    expect(labels).toContain("Financeiro");
    expect(labels).toContain("Energia Elétrica");
    expect(labels).toContain("Logística");
    expect(labels).toContain("Outros Setores");

    const others = result.sectorSegments.find((s) => s.label === "Outros Setores");
    expect(others).toBeDefined();
    expect(others?.value).toBe(500); // 200 + 150 + 150
    expect(others?.pct).toBe(5);
  });

  it("lida graciosamente com setores nulos ou vazios", () => {
    const positions = [
      { assetClass: "Internacional", sector: null, valueBRL: 500 },
      { assetClass: "Ações", sector: "", valueBRL: 500 },
    ];

    const result = buildAllocationDonutSegments({
      positions,
      cashBalanceBRL: 0,
    });

    expect(result.totalBRL).toBe(1000);
    expect(result.sectorSegments.length).toBeGreaterThan(0);
    for (const sec of result.sectorSegments) {
      expect(sec.label).not.toBeNull();
      expect(sec.label.length).toBeGreaterThan(0);
    }
  });

  it("retorna arrays vazios em carteira vazia", () => {
    const result = buildAllocationDonutSegments({
      positions: [],
      cashBalanceBRL: 0,
    });

    expect(result.totalBRL).toBe(0);
    expect(result.classSegments).toEqual([]);
    expect(result.sectorSegments).toEqual([]);
  });
});
