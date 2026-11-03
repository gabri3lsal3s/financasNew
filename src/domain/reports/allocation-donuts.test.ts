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

  it("aplica agrupamento de cauda longa quando houver mais de 12 setores ou fatias < 1%", () => {
    const positions = [
      { assetClass: "Ações", sector: "Financeiro", valueBRL: 2500 },
      { assetClass: "Ações", sector: "Energia Elétrica", valueBRL: 1500 },
      { assetClass: "FIIs", sector: "Logística", valueBRL: 1200 },
      { assetClass: "Ações", sector: "Tecnologia", valueBRL: 1000 },
      { assetClass: "Ações", sector: "Saneamento", valueBRL: 800 },
      { assetClass: "Ações", sector: "Saúde", valueBRL: 600 },
      { assetClass: "Ações", sector: "Varejo", valueBRL: 500 },
      { assetClass: "Ações", sector: "Telecom", valueBRL: 400 },
      { assetClass: "Ações", sector: "Agronegócio", valueBRL: 350 },
      { assetClass: "Ações", sector: "Mineração", valueBRL: 300 },
      { assetClass: "Ações", sector: "Construção", valueBRL: 250 },
      { assetClass: "Ações", sector: "Educação", valueBRL: 200 },
      // Setores excedentes ou menores (< 1% de 10.000 = 100):
      { assetClass: "Ações", sector: "Química", valueBRL: 80 },
      { assetClass: "Ações", sector: "Têxtil", valueBRL: 60 },
      { assetClass: "Ações", sector: "Transporte", valueBRL: 60 },
      { assetClass: "Ações", sector: "Outros Negócios", valueBRL: 200 },
    ];

    const result = buildAllocationDonutSegments({
      positions,
      cashBalanceBRL: 0,
      includeCash: false,
    });

    expect(result.totalBRL).toBe(10000);
    expect(result.totalUniqueSectors).toBe(16);

    // Deve conter os maiores setores + "Outros Setores"
    const labels = result.sectorSegments.map((s) => s.label);
    expect(labels).toContain("Financeiro");
    expect(labels).toContain("Energia Elétrica");
    expect(labels).toContain("Logística");
    expect(labels).toContain("Outros Setores");

    const others = result.sectorSegments.find((s) => s.label === "Outros Setores");
    expect(others).toBeDefined();
    expect(others?.value).toBe(400); // 80 + 60 + 60 + 200
    expect(others?.pct).toBe(4);
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

  it("garante que percentuais somam rigorosamente 100,0% e isola Caixa dos setores produtivos", () => {
    const positions = [
      { assetClass: "Ações", sector: "Financeiro", valueBRL: 2384 },
      { assetClass: "FIIs", sector: "Logística", valueBRL: 2386 },
      { assetClass: "Renda Fixa", sector: "Títulos Públicos", valueBRL: 2996 },
      { assetClass: "Internacional", sector: "Tecnologia", valueBRL: 2172 },
    ];
    // Caixa microscópico de 0.54% (54 / 10000)
    const cashBalanceBRL = 54;

    const result = buildAllocationDonutSegments({
      positions,
      cashBalanceBRL,
      includeCash: true,
    });

    expect(result.totalBRL).toBe(9992);

    // Soma das classes deve fechar exatamente em 100,0%
    const sumClasses = result.classSegments.reduce((acc, c) => acc + c.pct, 0);
    expect(Math.round(sumClasses * 10) / 10).toBe(100.0);

    // Soma dos setores deve fechar exatamente em 100,0%
    const sumSectors = result.sectorSegments.reduce((acc, s) => acc + s.pct, 0);
    expect(Math.round(sumSectors * 10) / 10).toBe(100.0);

    // Caixa não cai em Outros Setores, tem cor esmeralda #10b981
    const cashSegment = result.sectorSegments.find((s) => s.label === "Reserva de Caixa");
    expect(cashSegment).toBeDefined();
    expect(cashSegment?.color).toBe("#10b981");

    // totalUniqueSectors reporta apenas os 4 setores corporativos reais
    expect(result.totalUniqueSectors).toBe(4);
  });
});
