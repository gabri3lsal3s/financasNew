import { describe, expect, it } from "vitest";
import {
  stringToBase64Url,
  base64UrlToString,
  serializeStateToQueryParam,
  deserializeStateFromQueryParam,
  buildStatefulUrl,
  parseStatefulUrl,
  encodeCompoundInterestState,
  decodeCompoundInterestState,
  encodeDebtSimulatorState,
  decodeDebtSimulatorState,
  encodeRebalanceSimulatorState,
  decodeRebalanceSimulatorState,
  MAX_STATEFUL_PAYLOAD_LENGTH,
  type CompoundInterestShareState,
  type DebtSimulatorShareState,
  type RebalanceSimulatorShareState,
} from "./stateful-url";

describe("domain/share/stateful-url — Motor de Serialização e Compartilhamento", () => {
  describe("stringToBase64Url & base64UrlToString (Codificação pura)", () => {
    it("codifica e decodifica texto simples em ASCII perfeitamente", () => {
      const original = "Hello World! 123";
      const encoded = stringToBase64Url(original);
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toContain("=");
      expect(base64UrlToString(encoded)).toBe(original);
    });

    it("suporta caracteres UTF-8 e acentuação pt-BR sem corrupção", () => {
      const original = "Cartão de Crédito · Ações de Dividendos · R$ 1.500,00";
      const encoded = stringToBase64Url(original);
      expect(base64UrlToString(encoded)).toBe(original);
    });

    it("retorna null para strings vazias, inválidas ou corrompidas", () => {
      expect(base64UrlToString("")).toBeNull();
      // @ts-expect-error teste com valor inválido
      expect(base64UrlToString(null)).toBeNull();
      // Caracteres não permitidos em base64
      expect(base64UrlToString("???invalid%%")).toBeNull();
    });

    it("rejeita payloads que excedem o limite de segurança de tamanho", () => {
      const hugeString = "a".repeat(MAX_STATEFUL_PAYLOAD_LENGTH + 10);
      expect(base64UrlToString(hugeString)).toBeNull();
    });
  });

  describe("serializeStateToQueryParam & deserializeStateFromQueryParam (Genérico)", () => {
    it("serializa e desserializa objetos preservando números e tipos", () => {
      const payload = { amount: 150000, rate: 10.5, name: "Teste" };
      const param = serializeStateToQueryParam(payload);

      expect(typeof param).toBe("string");
      expect(param.length).toBeGreaterThan(0);

      const restored = deserializeStateFromQueryParam<typeof payload>(param);
      expect(restored).toEqual(payload);
    });

    it("retorna null ao desserializar string que não é JSON válido", () => {
      const invalidJsonBase64 = stringToBase64Url("{ invalid json: ");
      expect(deserializeStateFromQueryParam(invalidJsonBase64)).toBeNull();
    });

    it("retorna null se a string fornecida for nula ou indefinida", () => {
      expect(deserializeStateFromQueryParam(null)).toBeNull();
      expect(deserializeStateFromQueryParam(undefined)).toBeNull();
      expect(deserializeStateFromQueryParam("")).toBeNull();
    });
  });

  describe("buildStatefulUrl & parseStatefulUrl", () => {
    it("anexa o parâmetro serializado à URL base preservando o path", () => {
      const state = { step: 1 };
      const url = buildStatefulUrl("/ferramentas/juros-compostos", state);

      expect(url).toMatch(/^\/ferramentas\/juros-compostos\?s=[a-zA-Z0-9_-]+$/);
    });

    it("preserva query parameters pré-existentes na URL", () => {
      const state = { active: true };
      const url = buildStatefulUrl("https://axis.app/ferramentas/dividas?source=hub", state);

      expect(url).toContain("source=hub");
      expect(url).toContain("s=");
    });

    it("extrai o estado de uma URL completa com sucesso", () => {
      const state = { value: 42 };
      const url = buildStatefulUrl("https://axis.app/ferramentas/teste", state);

      const parsed = parseStatefulUrl<{ value: number }>(url);
      expect(parsed).toEqual(state);
    });

    it("extrai o estado de uma query string pura", () => {
      const state = { flag: "ok" };
      const param = serializeStateToQueryParam(state);

      const parsed = parseStatefulUrl<{ flag: string }>(`?s=${param}`);
      expect(parsed).toEqual(state);
    });

    it("extrai o estado quando passado apenas o valor bruto do token", () => {
      const state = { alpha: 99 };
      const param = serializeStateToQueryParam(state);

      const parsed = parseStatefulUrl<{ alpha: number }>(param);
      expect(parsed).toEqual(state);
    });

    it("permite customizar o nome do query param", () => {
      const state = { custom: 123 };
      const url = buildStatefulUrl("/rota", state, "dados");

      expect(url).toContain("dados=");
      const parsed = parseStatefulUrl<{ custom: number }>(url, undefined, "dados");
      expect(parsed).toEqual(state);
    });
  });

  describe("Simulador de Juros Compostos (CompoundInterestState)", () => {
    const sampleState: CompoundInterestShareState = {
      initialAmountCents: 1000000,
      monthlyContributionCents: 150000,
      annualRatePercent: 10.5,
      periodYears: 25,
      monthlyLivingCostCents: 600000,
    };

    it("codifica e decodifica fielmente o estado do simulador", () => {
      const encoded = encodeCompoundInterestState(sampleState);
      const decoded = decodeCompoundInterestState(encoded);

      expect(decoded).toEqual(sampleState);
    });

    it("decodifica a partir de uma URL completa", () => {
      const url = buildStatefulUrl("/ferramentas/juros-compostos", sampleState);
      const decoded = decodeCompoundInterestState(url);

      expect(decoded).toEqual(sampleState);
    });

    it("rejeita valores negativos ou períodos fora da faixa válida", () => {
      const invalid = {
        ...sampleState,
        periodYears: -5,
      };
      const encoded = serializeStateToQueryParam(invalid);
      expect(decodeCompoundInterestState(encoded)).toBeNull();
    });
  });

  describe("Simulador de Dívidas (DebtSimulatorState)", () => {
    const sampleDebtState: DebtSimulatorShareState = {
      debts: [
        {
          id: "debt-1",
          name: "Cartão Santander",
          balanceCents: 450000,
          monthlyRatePercent: 12.0,
          minPaymentCents: 45000,
        },
        {
          id: "debt-2",
          name: "Empréstimo Caixa",
          balanceCents: 1200000,
          monthlyRatePercent: 3.2,
          minPaymentCents: 50000,
        },
      ],
      extraBudgetCents: 60000,
      strategy: "avalanche",
    };

    it("codifica e decodifica a lista de dívidas e estratégia com sucesso", () => {
      const encoded = encodeDebtSimulatorState(sampleDebtState);
      const decoded = decodeDebtSimulatorState(encoded);

      expect(decoded).toEqual(sampleDebtState);
    });

    it("rejeita lista vazia de dívidas", () => {
      const invalid = {
        debts: [],
        extraBudgetCents: 1000,
      };
      const encoded = serializeStateToQueryParam(invalid);
      expect(decodeDebtSimulatorState(encoded)).toBeNull();
    });

    it("rejeita estratégia desconhecida", () => {
      const invalid = {
        ...sampleDebtState,
        strategy: "desconhecida",
      };
      const encoded = serializeStateToQueryParam(invalid);
      expect(decodeDebtSimulatorState(encoded)).toBeNull();
    });
  });

  describe("Simulador de Rebalanceamento (RebalanceSimulatorState)", () => {
    const sampleRebalanceState: RebalanceSimulatorShareState = {
      patrimonyBaseCents: 10000000,
      aporteAmountCents: 500000,
      classes: [
        {
          key: "fiis",
          name: "Fundos Imobiliários",
          targetPercent: 40,
          currentProportion: 0.35,
          yieldRate: 0.1,
        },
        {
          key: "acoes",
          name: "Ações Brasil",
          targetPercent: 60,
          currentProportion: 0.65,
          yieldRate: 0.08,
        },
      ],
      selectedPreset: "dividendos",
    };

    it("codifica e decodifica as classes e alocações de investimento", () => {
      const encoded = encodeRebalanceSimulatorState(sampleRebalanceState);
      const decoded = decodeRebalanceSimulatorState(encoded);

      expect(decoded).toEqual(sampleRebalanceState);
    });

    it("rejeita percentuais de meta negativos ou acima de 100", () => {
      const invalid = {
        ...sampleRebalanceState,
        classes: [
          {
            key: "fiis",
            name: "Fundos Imobiliários",
            targetPercent: 150,
            currentProportion: 0.35,
          },
        ],
      };
      const encoded = serializeStateToQueryParam(invalid);
      expect(decodeRebalanceSimulatorState(encoded)).toBeNull();
    });
  });
});
