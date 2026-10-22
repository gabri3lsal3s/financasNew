import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  resetSmartAdvisorCooldowns,
  useSmartAdvisorInsights,
} from "./use-smart-advisor-insights";
import {
  SMART_ADVISOR_DISMISSALS_KEY,
  SMART_ADVISOR_LAST_DISMISSED_DAY_KEY,
} from "@/domain/insights/advisor";
import type { ExpenseLike, IncomeLike } from "@/domain/insights/recurrences";

// Mocks dos serviços sensoriais e toast
const mutateFeedbackMock = vi.fn().mockResolvedValue({});
const mutateCreateIncomeMock = vi.fn().mockResolvedValue({});
const pushToastMock = vi.fn();
const triggerSensoryMock = vi.fn();

vi.mock("@/services/toast", () => ({
  pushToast: (args: unknown) => pushToastMock(args),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: (args: unknown) => triggerSensoryMock(args),
}));

vi.mock("@/state", () => ({
  useExpenses: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useIncomes: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useBudgets: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCategories: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useFeedback: () => ({ data: {}, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSetFeedback: () => ({ mutateAsync: mutateFeedbackMock }),
  useCreateIncome: () => ({ mutateAsync: mutateCreateIncomeMock }),
}));

describe("useSmartAdvisorInsights", () => {
  const TODAY = "2026-10-22";
  const NOW_MS = new Date("2026-10-22T10:00:00Z").getTime();

  beforeEach(() => {
    localStorage.clear();
    resetSmartAdvisorCooldowns();
    vi.clearAllMocks();
  });

  describe("Matriz de Prioridade Canônica", () => {
    it("Prioridade 1: Exibe cobrança duplicada imediatamente", () => {
      const expenses: ExpenseLike[] = [
        // Netflix duplicada em 2026-10
        {
          id: "e1",
          description: "Netflix",
          valueCents: 5590,
          month: "2026-10",
          date: "2026-10-05",
          categoryId: "cat-stream",
          categoryName: "Streaming",
          categoryIcon: "tv",
        },
        {
          id: "e2",
          description: "Netflix",
          valueCents: 5590,
          month: "2026-10",
          date: "2026-10-18",
          categoryId: "cat-stream",
          categoryName: "Streaming",
          categoryIcon: "tv",
        },
        // Histórico meses anteriores
        {
          id: "e3",
          description: "Netflix",
          valueCents: 5590,
          month: "2026-09",
          date: "2026-09-05",
          categoryId: "cat-stream",
          categoryName: "Streaming",
          categoryIcon: "tv",
        },
        {
          id: "e4",
          description: "Netflix",
          valueCents: 5590,
          month: "2026-08",
          date: "2026-08-05",
          categoryId: "cat-stream",
          categoryName: "Streaming",
          categoryIcon: "tv",
        },
      ];

      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses,
          incomes: [],
          todayISO: TODAY,
          nowMs: NOW_MS,
        }),
      );

      expect(result.current.insight).not.toBeNull();
      expect(result.current.insight?.priority).toBe(1);
      expect(result.current.insight?.category).toBe("critical");
      expect(result.current.insight?.title).toBe("Cobrança duplicada detectada");
      expect(result.current.insight?.themeKey).toBe("dup:sub:netflix");
    });

    it("Prioridade 2: Exibe confirmação de renda habitual quando não há anomalia crítica", () => {
      const incomes: IncomeLike[] = [
        {
          id: "i1",
          description: "Salário ACME Corp",
          valueCents: 750000,
          month: "2026-09",
          date: "2026-09-22",
          categoryId: "cat-sal",
          categoryName: "Salário",
        },
        {
          id: "i2",
          description: "Salário ACME Corp",
          valueCents: 750000,
          month: "2026-08",
          date: "2026-08-22",
          categoryId: "cat-sal",
          categoryName: "Salário",
        },
      ];

      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses: [],
          incomes,
          todayISO: TODAY,
          nowMs: NOW_MS,
        }),
      );

      expect(result.current.insight).not.toBeNull();
      expect(result.current.insight?.priority).toBe(2);
      expect(result.current.insight?.category).toBe("income");
      expect(result.current.insight?.title).toBe("Confirmar recebimento");
      expect(result.current.insight?.primaryAction?.kind).toBe("confirm_income");
    });

    it("Prioridade 3: Exibe oportunidade de economia / reajuste quando não há prioridade 1 ou 2", () => {
      const expenses: ExpenseLike[] = [
        // Assinatura de streaming can_cut estável sem duplicidade
        {
          id: "e1",
          description: "Deezer HiFi",
          valueCents: 3490,
          month: "2026-10",
          date: "2026-10-10",
          categoryId: "cat-stream",
          categoryName: "Streaming",
          categoryIcon: "tv",
        },
        {
          id: "e2",
          description: "Deezer HiFi",
          valueCents: 3490,
          month: "2026-09",
          date: "2026-09-10",
          categoryId: "cat-stream",
          categoryName: "Streaming",
          categoryIcon: "tv",
        },
        {
          id: "e3",
          description: "Deezer HiFi",
          valueCents: 3490,
          month: "2026-08",
          date: "2026-08-10",
          categoryId: "cat-stream",
          categoryName: "Streaming",
          categoryIcon: "tv",
        },
      ];

      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses,
          incomes: [],
          todayISO: TODAY,
          nowMs: NOW_MS,
        }),
      );

      expect(result.current.insight).not.toBeNull();
      expect(result.current.insight?.priority).toBe(3);
      expect(result.current.insight?.category).toBe("savings");
      expect(result.current.insight?.title).toBe("Oportunidade de economia");
    });

    it("Prioridade 4: Exibe calibração quando há gasto recorrente ainda não avaliado", () => {
      const expenses: ExpenseLike[] = [
        // Gasto recorrente em academia/clube sem categoria essencial
        {
          id: "e1",
          description: "Crossfit Centro",
          valueCents: 22000,
          month: "2026-10",
          date: "2026-10-10",
          categoryId: "cat-outro",
          categoryName: "Outros",
        },
        {
          id: "e2",
          description: "Crossfit Centro",
          valueCents: 22000,
          month: "2026-09",
          date: "2026-09-10",
          categoryId: "cat-outro",
          categoryName: "Outros",
        },
        {
          id: "e3",
          description: "Crossfit Centro",
          valueCents: 22000,
          month: "2026-08",
          date: "2026-08-10",
          categoryId: "cat-outro",
          categoryName: "Outros",
        },
      ];

      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses,
          incomes: [],
          todayISO: TODAY,
          nowMs: NOW_MS,
        }),
      );

      expect(result.current.insight).not.toBeNull();
      expect(result.current.insight?.priority).toBe(4);
      expect(result.current.insight?.category).toBe("calibration");
      expect(result.current.insight?.title).toBe("Calibração de gastos fixos");
      expect(result.current.insight?.primaryAction?.kind).toBe("confirm_recurrence");
      expect(result.current.insight?.secondaryAction?.kind).toBe("ignore_recurrence");
    });

    it("Card fica 100% oculto (null) quando o mês está regular sem anomalias", () => {
      const expenses: ExpenseLike[] = [
        {
          id: "e1",
          description: "Cafeteria",
          valueCents: 1500,
          month: "2026-10",
          date: "2026-10-02",
          categoryId: "cat-alimentacao",
        },
        {
          id: "e2",
          description: "Livraria",
          valueCents: 4500,
          month: "2026-10",
          date: "2026-10-04",
          categoryId: "cat-lazer",
        },
      ];

      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses,
          incomes: [],
          todayISO: TODAY,
          nowMs: NOW_MS,
        }),
      );

      expect(result.current.insight).toBeNull();
    });
  });

  describe("Política de Cooldown e Regra de Discrição", () => {
    const expensesWithDup: ExpenseLike[] = [
      {
        id: "e1",
        description: "Netflix",
        valueCents: 5590,
        month: "2026-10",
        date: "2026-10-05",
        categoryId: "cat-stream",
        categoryName: "Streaming",
        categoryIcon: "tv",
      },
      {
        id: "e2",
        description: "Netflix",
        valueCents: 5590,
        month: "2026-10",
        date: "2026-10-18",
        categoryId: "cat-stream",
        categoryName: "Streaming",
        categoryIcon: "tv",
      },
      {
        id: "e3",
        description: "Netflix",
        valueCents: 5590,
        month: "2026-09",
        date: "2026-09-05",
        categoryId: "cat-stream",
        categoryName: "Streaming",
        categoryIcon: "tv",
      },
    ];

    it("ao dispensar, silencia o card pelo restante do dia atual", () => {
      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses: expensesWithDup,
          todayISO: TODAY,
          nowMs: NOW_MS,
        }),
      );

      expect(result.current.insight).not.toBeNull();

      act(() => {
        result.current.dismiss();
      });

      // Imediatamente oculto
      expect(result.current.insight).toBeNull();
      expect(localStorage.getItem(SMART_ADVISOR_LAST_DISMISSED_DAY_KEY)).toBe(TODAY);
      expect(triggerSensoryMock).toHaveBeenCalledWith("action");
    });

    it("silencia o tema específico por 30 dias no localStorage", () => {
      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses: expensesWithDup,
          todayISO: TODAY,
          nowMs: NOW_MS,
        }),
      );

      act(() => {
        result.current.dismiss("dup:netflix", 30);
      });

      const storedRaw = localStorage.getItem(SMART_ADVISOR_DISMISSALS_KEY);
      expect(storedRaw).toBeTruthy();
      const parsed = JSON.parse(storedRaw ?? "{}") as Record<string, number>;
      const expiry = parsed["dup:netflix"];
      expect(expiry).toBeDefined();
      expect(expiry).toBeGreaterThan(NOW_MS);
      // Deve ser aproximadamente 30 dias à frente
      const diffDays = Math.round(((expiry ?? 0) - NOW_MS) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it("no dia seguinte, se o tema anterior estiver em cooldown, exibe o próximo tema elegível", () => {
      const incomes: IncomeLike[] = [
        {
          id: "i1",
          description: "Freelance Design",
          valueCents: 200000,
          month: "2026-09",
          date: "2026-09-23",
          categoryId: "cat-sal",
          categoryName: "Renda",
        },
        {
          id: "i2",
          description: "Freelance Design",
          valueCents: 200000,
          month: "2026-08",
          date: "2026-08-23",
          categoryId: "cat-sal",
          categoryName: "Renda",
        },
      ];

      // dup:netflix está em cooldown de 30 dias, mas a data é o dia seguinte (2026-10-23)
      const NEXT_DAY = "2026-10-23";
      const NEXT_DAY_MS = NOW_MS + 24 * 60 * 60 * 1000;

      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses: expensesWithDup,
          incomes,
          todayISO: NEXT_DAY,
          nowMs: NEXT_DAY_MS,
          initialDismissals: {
            "dup:sub:netflix": NEXT_DAY_MS + 29 * 24 * 60 * 60 * 1000, // ainda 29 dias restantes
          },
          initialLastDismissedDay: TODAY, // dispensado ontem
        }),
      );

      // Como dup:sub:netflix está silenciado, o próximo elegível (Renda) é apresentado
      expect(result.current.insight).not.toBeNull();
      expect(result.current.insight?.themeKey).toBe("income:fixed:freelance design");
      expect(result.current.insight?.priority).toBe(2);
    });
  });

  describe("Ações de Calibração e Renda", () => {
    it("confirmRecurrence chama a mutação com decision confirm e dispara sensory/toast", async () => {
      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses: [],
          todayISO: TODAY,
        }),
      );

      await act(async () => {
        await result.current.confirmRecurrence("academia-bairro");
      });

      expect(mutateFeedbackMock).toHaveBeenCalledWith({
        occurrenceKey: "academia-bairro",
        decision: "confirm",
      });
      expect(triggerSensoryMock).toHaveBeenCalledWith("success");
      expect(pushToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Recorrência confirmada",
        }),
      );
    });

    it("ignoreRecurrence chama a mutação com decision ignore e dispara sensory/toast", async () => {
      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses: [],
          todayISO: TODAY,
        }),
      );

      await act(async () => {
        await result.current.ignoreRecurrence("aluguel-temporada");
      });

      expect(mutateFeedbackMock).toHaveBeenCalledWith({
        occurrenceKey: "aluguel-temporada",
        decision: "ignore",
      });
      expect(triggerSensoryMock).toHaveBeenCalledWith("action");
      expect(pushToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Gasto ignorado",
        }),
      );
    });

    it("confirmIncome cria a renda com o valor em reais e silencia o tema por 30 dias", async () => {
      const { result } = renderHook(() =>
        useSmartAdvisorInsights({
          expenses: [],
          todayISO: TODAY,
          nowMs: NOW_MS,
        }),
      );

      await act(async () => {
        await result.current.confirmIncome({
          name: "Consultoria Dev",
          valueCents: 500000, // R$ 5.000,00
          categoryId: "cat-freela",
          date: "2026-10-22",
        });
      });

      expect(mutateCreateIncomeMock).toHaveBeenCalledWith({
        description: "Consultoria Dev",
        value: 5000,
        category_id: "cat-freela",
        date: "2026-10-22",
        receive_type: "pix",
        report_weight: 1,
        source_ref: null,
      });
      expect(triggerSensoryMock).toHaveBeenCalledWith("success");
      expect(pushToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Entrada confirmada",
        }),
      );
      // Tema da renda silenciado no localStorage
      const stored = localStorage.getItem(SMART_ADVISOR_DISMISSALS_KEY);
      expect(stored).toContain("income:consultoria dev");
    });
  });
});
