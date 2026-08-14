import { describe, expect, it } from "vitest";
import {
  classCapsFromSectorCaps,
  simulateRebalanceAporte,
  simulateSmartAporte,
  type AporteAssetInput,
} from "./aporte";

const asset = (overrides: Partial<AporteAssetInput> & Pick<AporteAssetInput, "id" | "ticker">): AporteAssetInput => ({
  assetClass: null,
  currency: "BRL",
  currentValueBRL: 0,
  priceBRL: 0,
  targetPercentage: null,
  ...overrides,
});

describe("simulateSmartAporte — por meta de ativo (§3.11.3)", () => {
  it("aloca por gap financeiro desc e nunca excede o aporte informado", () => {
    const result = simulateSmartAporte({
      aporte: 10_000,
      assets: [
        asset({ id: "a", ticker: "A", currentValueBRL: 1000, priceBRL: 100, targetPercentage: 50 }),
        asset({ id: "b", ticker: "B", currentValueBRL: 4000, priceBRL: 200, targetPercentage: 40 }),
      ],
    });
    // Patrimônio alvo = 5000 + 10000 = 15000.
    // A: alvo 50% = 7500 → gap 6500; B: alvo 40% = 6000 → gap 2000.
    expect(result.routes).toHaveLength(2);
    const a = result.routes.find((r) => r.ticker === "A");
    const b = result.routes.find((r) => r.ticker === "B");
    expect(a).toMatchObject({ targetValueBRL: 7500, gapBRL: 6500, quantity: 65, allocatedBRL: 6500 });
    expect(b).toMatchObject({ targetValueBRL: 6000, gapBRL: 2000, quantity: 10, allocatedBRL: 2000 });
    expect(result.totalAllocated).toBe(8500);
    expect(result.leftover).toBe(1500); // sobra → caixa/reserva
    expect(result.totalAllocated).toBeLessThanOrEqual(result.aporte);
  });

  it("ativo sem meta não recebe aporte", () => {
    const result = simulateSmartAporte({
      aporte: 5000,
      assets: [
        asset({ id: "c", ticker: "C", currentValueBRL: 500, priceBRL: 50, targetPercentage: null }),
        asset({ id: "a", ticker: "A", currentValueBRL: 0, priceBRL: 100, targetPercentage: 10 }),
      ],
    });
    expect(result.routes.map((r) => r.ticker)).toEqual(["A"]);
    expect(result.routes[0]?.allocatedBRL).toBe(500);
  });

  it("ativo acima da meta (gap ≤ 0) não recebe aporte", () => {
    const result = simulateSmartAporte({
      aporte: 3000,
      assets: [
        // Atual 9000 ≥ alvo (50% de 12000 = 6000) → sem gap.
        asset({ id: "a", ticker: "A", currentValueBRL: 9000, priceBRL: 100, targetPercentage: 50 }),
        asset({ id: "b", ticker: "B", currentValueBRL: 0, priceBRL: 50, targetPercentage: 20 }),
      ],
    });
    expect(result.routes.map((r) => r.ticker)).toEqual(["B"]);
  });

  it("sem preço disponível o ativo não é elegível (não comprável)", () => {
    const result = simulateSmartAporte({
      aporte: 1000,
      assets: [asset({ id: "a", ticker: "A", currentValueBRL: 0, priceBRL: 0, targetPercentage: 30 })],
    });
    expect(result.routes).toHaveLength(0);
    expect(result.leftover).toBe(1000);
  });

  it("quantidades inteiras: excedente por arredondamento volta à sobra", () => {
    const result = simulateSmartAporte({
      aporte: 1000,
      assets: [asset({ id: "a", ticker: "A", currentValueBRL: 0, priceBRL: 300, targetPercentage: 100 })],
    });
    // 1000 ÷ 300 → 3 cotas = 900; sobra 100.
    expect(result.routes[0]).toMatchObject({ quantity: 3, allocatedBRL: 900 });
    expect(result.leftover).toBe(100);
  });

  it("quando o gap é menor que o preço, nada é alocado (sem fração)", () => {
    const result = simulateSmartAporte({
      aporte: 5000,
      assets: [asset({ id: "a", ticker: "A", currentValueBRL: 4900, priceBRL: 250, targetPercentage: 100 })],
    });
    // Alvo = 9900; gap = 5000; 5000 ÷ 250 = 20 → aloca 5000.
    expect(result.routes[0]?.allocatedBRL).toBe(5000);
    expect(result.leftover).toBe(0);
  });

  it("aporte zero ou negativo → resultado vazio com sobra total", () => {
    for (const aporte of [0, -100]) {
      const result = simulateSmartAporte({
        aporte,
        assets: [asset({ id: "a", ticker: "A", currentValueBRL: 0, priceBRL: 100, targetPercentage: 10 })],
      });
      expect(result.routes).toHaveLength(0);
      expect(result.totalAllocated).toBe(0);
      expect(result.leftover).toBe(0);
    }
  });

  it("prioriza a classe com maior déficit relativo (defasagem macro)", () => {
    const result = simulateSmartAporte({
      aporte: 1000,
      assets: [
        // Classe X: déficit relativo menor (alvo 226, atual 100 → 56%), gap absoluto maior (126).
        asset({ id: "x", ticker: "X1", assetClass: "X", currentValueBRL: 100, priceBRL: 10, targetPercentage: 20 }),
        // Classe Y: déficit relativo maior (alvo 113, atual 30 → 73%), gap absoluto menor (83).
        asset({ id: "y", ticker: "Y1", assetClass: "Y", currentValueBRL: 30, priceBRL: 10, targetPercentage: 10 }),
      ],
    });
    // Patrimônio alvo = 130 + 1000 = 1130. Y vem primeiro (73% > 56%) apesar do gap menor.
    expect(result.routes.map((r) => r.ticker)).toEqual(["Y1", "X1"]);
    expect(result.routes[0]).toMatchObject({ ticker: "Y1", quantity: 8, allocatedBRL: 80 });
    expect(result.routes[1]).toMatchObject({ ticker: "X1", quantity: 12, allocatedBRL: 120 });
  });

  it("trava setorial limita a alocação da classe (max_sector_acoes)", () => {
    const result = simulateSmartAporte({
      aporte: 2000,
      assets: [
        asset({ id: "a", ticker: "PETR4", assetClass: "Ações", currentValueBRL: 1000, priceBRL: 100, targetPercentage: 80 }),
        asset({ id: "c", ticker: "CAIXA", assetClass: "caixa", currentValueBRL: 1000, priceBRL: 1, targetPercentage: null }),
      ],
      classCaps: [{ className: "Ações", cap: 40 }],
    });
    // Patrimônio alvo = 2000 + 2000 = 4000. Teto da classe = 40% × 4000 = 1600.
    // Atual 1000 → cabe no máximo 600 (6 cotas × 100).
    expect(result.routes[0]).toMatchObject({ ticker: "PETR4", quantity: 6, allocatedBRL: 600 });
    expect(result.leftover).toBe(1400);
  });
});

describe("simulateRebalanceAporte — por meta de classe (§3.11.3)", () => {
  it("distribui o déficit da classe proporcionalmente ao valor atual", () => {
    const result = simulateRebalanceAporte({
      aporte: 6000,
      assets: [
        asset({ id: "a", ticker: "A", assetClass: "Ações", currentValueBRL: 1000, priceBRL: 100 }),
        asset({ id: "b", ticker: "B", assetClass: "Ações", currentValueBRL: 3000, priceBRL: 200 }),
      ],
      classTargets: [{ className: "Ações", targetPercentage: 60 }],
    });
    // Patrimônio alvo = 4000 + 6000 = 10000. Classe alvo 60% = 6000.
    // A share 25% → alvo 1500 (gap 500); B share 75% → alvo 4500 (gap 1500).
    expect(result.mode).toBe("class");
    expect(result.routes.map((r) => r.ticker)).toEqual(["B", "A"]); // gap desc dentro da classe
    const a = result.routes.find((r) => r.ticker === "A");
    const b = result.routes.find((r) => r.ticker === "B");
    expect(a).toMatchObject({ targetValueBRL: 1500, quantity: 5, allocatedBRL: 500 });
    expect(b).toMatchObject({ targetValueBRL: 4500, quantity: 7, allocatedBRL: 1400 });
    expect(result.totalAllocated).toBe(1900);
    expect(result.leftover).toBe(4100);
  });

  it("classe sem meta não gera aporte; metas individuais são ignoradas", () => {
    const result = simulateRebalanceAporte({
      aporte: 2000,
      assets: [
        // Meta individual alta, mas a classe não tem meta → nada.
        asset({ id: "a", ticker: "A", assetClass: "Ações", currentValueBRL: 0, priceBRL: 100, targetPercentage: 80 }),
        asset({ id: "b", ticker: "B", assetClass: "RF", currentValueBRL: 0, priceBRL: 50 }),
      ],
      classTargets: [{ className: "RF", targetPercentage: 20 }],
    });
    expect(result.routes.map((r) => r.ticker)).toEqual(["B"]);
  });

  it("classe sem valor atual distribui em partes iguais (share = 1/n)", () => {
    const result = simulateRebalanceAporte({
      aporte: 1000,
      assets: [
        asset({ id: "a", ticker: "A", assetClass: "Cripto", currentValueBRL: 0, priceBRL: 10 }),
        asset({ id: "b", ticker: "B", assetClass: "Cripto", currentValueBRL: 0, priceBRL: 20 }),
      ],
      classTargets: [{ className: "Cripto", targetPercentage: 10 }],
    });
    // Patrimônio alvo = 1000. Classe alvo 10% = 100 → share 50% cada.
    expect(result.routes[0]).toMatchObject({ ticker: "A", targetValueBRL: 50 });
    expect(result.routes[1]).toMatchObject({ ticker: "B", targetValueBRL: 50 });
  });

  it("trava setorial também vale no modo classe", () => {
    const result = simulateRebalanceAporte({
      aporte: 3000,
      assets: [
        asset({ id: "a", ticker: "FIIA", assetClass: "FIIs", currentValueBRL: 500, priceBRL: 100 }),
        asset({ id: "c", ticker: "CAIXA", assetClass: "caixa", currentValueBRL: 500, priceBRL: 1 }),
      ],
      classTargets: [{ className: "FIIs", targetPercentage: 80 }],
      classCaps: [{ className: "FIIs", cap: 30 }],
    });
    // Patrimônio alvo = 1000 + 3000 = 4000. Teto FIIs = 30% × 4000 = 1200.
    // Atual 500 → máximo 700 (7 cotas × 100).
    expect(result.routes[0]).toMatchObject({ ticker: "FIIA", quantity: 7, allocatedBRL: 700 });
    expect(result.leftover).toBe(2300);
  });
});

describe("classCapsFromSectorCaps — mapeamento das travas (§3.11.3.5)", () => {
  it("aplica max_sector_acoes e max_sector_fiis às classes correspondentes", () => {
    const caps = classCapsFromSectorCaps(["Ações", "FIIs", "Internacional"], 40, 25);
    expect(caps).toContainEqual({ className: "Ações", cap: 40 });
    expect(caps).toContainEqual({ className: "FIIs", cap: 25 });
    expect(caps).toContainEqual({ className: "Internacional", cap: null });
  });

  it("é insensível a caixa/acento e deduplica classes", () => {
    const caps = classCapsFromSectorCaps(["aÇÕES", "ações", "fundo imobiliário"], null, 30);
    expect(caps).toHaveLength(2);
    expect(caps[0]).toEqual({ className: "aÇÕES", cap: null }); // sem max_sector_acoes
    expect(caps[1]).toEqual({ className: "fundo imobiliário", cap: 30 });
  });

  it("sem trava configurada → todas as classes sem cap", () => {
    const caps = classCapsFromSectorCaps(["Ações", "FIIs"], null, null);
    expect(caps.every((c) => c.cap === null)).toBe(true);
  });
});
