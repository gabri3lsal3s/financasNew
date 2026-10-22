import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SmartAdvisorCard } from "./smart-advisor-card";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";

// Mocks dos serviços e roteamento
const triggerSensoryMock = vi.fn();
const mockNavigate = vi.fn();

const mockHookDismiss = vi.fn();
const mockHookConfirmIncome = vi.fn();
const mockHookConfirmRecurrence = vi.fn();
const mockHookIgnoreRecurrence = vi.fn();
const mockHookNext = vi.fn();
const mockHookPrev = vi.fn();
const mockHookGoTo = vi.fn();

let mockHookReturn: {
  insight: SmartAdvisorInsight | null;
  insights: SmartAdvisorInsight[];
  currentIndex: number;
  totalCount: number;
  nextInsight: typeof mockHookNext;
  prevInsight: typeof mockHookPrev;
  goToInsight: typeof mockHookGoTo;
  allCandidates: SmartAdvisorInsight[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  dismiss: typeof mockHookDismiss;
  confirmIncome: typeof mockHookConfirmIncome;
  confirmRecurrence: typeof mockHookConfirmRecurrence;
  ignoreRecurrence: typeof mockHookIgnoreRecurrence;
  refetch: () => Promise<void>;
} = {
  insight: null,
  insights: [],
  currentIndex: 0,
  totalCount: 0,
  nextInsight: mockHookNext,
  prevInsight: mockHookPrev,
  goToInsight: mockHookGoTo,
  allCandidates: [],
  isLoading: false,
  isError: false,
  error: null,
  dismiss: mockHookDismiss,
  confirmIncome: mockHookConfirmIncome,
  confirmRecurrence: mockHookConfirmRecurrence,
  ignoreRecurrence: mockHookIgnoreRecurrence,
  refetch: vi.fn(),
};

vi.mock("@/services/sensory", () => ({
  triggerSensory: (args: unknown) => triggerSensoryMock(args),
}));

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/features/overview/hooks", () => ({
  useSmartAdvisorInsights: () => mockHookReturn,
}));

describe("SmartAdvisorCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookReturn = {
      insight: null,
      insights: [],
      currentIndex: 0,
      totalCount: 0,
      nextInsight: mockHookNext,
      prevInsight: mockHookPrev,
      goToInsight: mockHookGoTo,
      allCandidates: [],
      isLoading: false,
      isError: false,
      error: null,
      dismiss: mockHookDismiss,
      confirmIncome: mockHookConfirmIncome,
      confirmRecurrence: mockHookConfirmRecurrence,
      ignoreRecurrence: mockHookIgnoreRecurrence,
      refetch: vi.fn(),
    };
  });

  const criticalInsight: SmartAdvisorInsight = {
    id: "dup:netflix",
    themeKey: "dup:netflix",
    priority: 1,
    category: "critical",
    title: "Cobrança duplicada detectada",
    description: "Identificamos 2 cobranças de Netflix no mês atual.",
    iconName: "alert-triangle",
    primaryAction: {
      label: "Ver cobranças",
      kind: "cut_subscription",
      payload: { key: "netflix" },
    },
    secondaryAction: {
      label: "Dispensar por 30 dias",
      kind: "dismiss",
    },
  };

  const incomeInsight: SmartAdvisorInsight = {
    id: "income:salario",
    themeKey: "income:salario",
    priority: 2,
    category: "income",
    title: "Confirmar recebimento",
    description: "Renda de ACME Corp (R$ 7.500,00) prevista por volta do dia 5.",
    iconName: "arrow-down-left",
    primaryAction: {
      label: "Confirmar entrada",
      kind: "confirm_income",
      payload: {
        name: "ACME Corp",
        valueCents: 750000,
        categoryId: "cat-sal",
        date: "2026-10-05",
      },
    },
  };

  const savingsInsight: SmartAdvisorInsight = {
    id: "savings:vampire",
    themeKey: "savings:vampire",
    priority: 3,
    category: "savings",
    title: "Oportunidade de economia",
    description: "Streaming Antigo custa R$ 598,80 por ano. Deseja manter?",
    iconName: "trending-down",
    primaryAction: {
      label: "Rever assinatura",
      kind: "cut_subscription",
      payload: { key: "streaming-antigo" },
    },
  };

  const aporteInsight: SmartAdvisorInsight = {
    id: "aporte:rebalance",
    themeKey: "aporte:rebalance",
    priority: 3,
    category: "savings",
    title: "Aporte para rebalanceamento",
    description: "Você poupou R$ 1.200,00 neste mês. Deseja realizar o aporte planejado para rebalancear sua carteira?",
    iconName: "trending-down",
    primaryAction: {
      label: "Realizar aporte",
      kind: "navigate_aporte",
      payload: { valorCents: 120000 },
    },
    secondaryAction: {
      label: "Dispensar por 30 dias",
      kind: "dismiss",
    },
  };

  const calibrationInsight: SmartAdvisorInsight = {
    id: "calib:academia",
    themeKey: "calib:academia",
    priority: 4,
    category: "calibration",
    title: "Calibração de gastos fixos",
    description: "Identificamos cobranças mensais em Academia Bairro. Deseja monitorar como gasto fixo?",
    iconName: "help-circle",
    primaryAction: {
      label: "Sim, monitorar",
      kind: "confirm_recurrence",
      payload: { key: "academia" },
    },
    secondaryAction: {
      label: "Não, foi pontual",
      kind: "ignore_recurrence",
      payload: { key: "academia" },
    },
  };

  it("não renderiza nada (100% oculto) quando o insight for null", () => {
    const { container } = render(<SmartAdvisorCard insight={null} />);
    expect(container.firstChild).toBeNull();
  });

  describe("Renderização nos 4 Estados Canônicos", () => {
    it("1. Crítica: renderiza badge Atenção, título e ação Ver cobranças", () => {
      render(<SmartAdvisorCard insight={criticalInsight} />);

      expect(screen.getByText("Atenção")).toBeInTheDocument();
      expect(screen.getByText("Cobrança duplicada detectada")).toBeInTheDocument();
      expect(screen.getByText(/Identificamos 2 cobranças de Netflix/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ver cobranças/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Dispensar por 30 dias/i })).toBeInTheDocument();
    });

    it("2. Entrada: renderiza badge Entrada Prevista e botão de 1 toque Confirmar entrada", () => {
      render(<SmartAdvisorCard insight={incomeInsight} />);

      expect(screen.getByText("Entrada Prevista")).toBeInTheDocument();
      expect(screen.getByText("Confirmar recebimento")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar entrada/i })).toBeInTheDocument();
    });

    it("3. Economia: renderiza badge Economia e ação Rever assinatura", () => {
      render(<SmartAdvisorCard insight={savingsInsight} />);

      expect(screen.getByText("Economia")).toBeInTheDocument();
      expect(screen.getByText("Oportunidade de economia")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Rever assinatura/i })).toBeInTheDocument();
    });

    it("4. Calibração: renderiza botões de feedback Sim, monitorar e Não, foi pontual", () => {
      render(<SmartAdvisorCard insight={calibrationInsight} />);

      expect(screen.getByText("Calibração")).toBeInTheDocument();
      expect(screen.getByText("Calibração de gastos fixos")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sim, monitorar/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Não, foi pontual/i })).toBeInTheDocument();
    });

    it("5. Aporte: renderiza badge Aporte e ação Realizar aporte", () => {
      render(<SmartAdvisorCard insight={aporteInsight} />);

      expect(screen.getByText("Aporte")).toBeInTheDocument();
      expect(screen.getByText("Aporte para rebalanceamento")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Realizar aporte/i })).toBeInTheDocument();
    });
  });

  describe("Ações Interativas e Disparo Sensorial", () => {
    it("ao clicar em Dispensar por 30 dias, executa onDismiss e dispara sensory action", () => {
      const onDismissMock = vi.fn();
      render(<SmartAdvisorCard insight={criticalInsight} onDismiss={onDismissMock} />);

      const dismissBtn = screen.getByRole("button", { name: /Dispensar por 30 dias/i });
      fireEvent.click(dismissBtn);

      expect(onDismissMock).toHaveBeenCalledWith("dup:netflix");
      expect(triggerSensoryMock).toHaveBeenCalledWith("action");
    });

    it("ao clicar em Confirmar entrada, executa onConfirmIncome com payload e dispara sensory success", async () => {
      const onConfirmIncomeMock = vi.fn().mockResolvedValue({});
      render(<SmartAdvisorCard insight={incomeInsight} onConfirmIncome={onConfirmIncomeMock} />);

      const confirmBtn = screen.getByRole("button", { name: /Confirmar entrada/i });
      fireEvent.click(confirmBtn);

      expect(onConfirmIncomeMock).toHaveBeenCalledWith({
        name: "ACME Corp",
        valueCents: 750000,
        categoryId: "cat-sal",
        date: "2026-10-05",
      });
      expect(triggerSensoryMock).toHaveBeenCalledWith("success");
    });

    it("ao clicar em Sim, monitorar, executa onConfirmRecurrence e dispara sensory success", async () => {
      const onConfirmRecurrenceMock = vi.fn().mockResolvedValue({});
      render(
        <SmartAdvisorCard
          insight={calibrationInsight}
          onConfirmRecurrence={onConfirmRecurrenceMock}
        />,
      );

      const simBtn = screen.getByRole("button", { name: /Sim, monitorar/i });
      fireEvent.click(simBtn);

      expect(onConfirmRecurrenceMock).toHaveBeenCalledWith("academia");
      expect(triggerSensoryMock).toHaveBeenCalledWith("success");
    });

    it("ao clicar em Não, foi pontual e selecionar no popover, executa onIgnoreRecurrence e dispara sensory action", async () => {
      const onIgnoreRecurrenceMock = vi.fn().mockResolvedValue({});
      render(
        <SmartAdvisorCard
          insight={calibrationInsight}
          onIgnoreRecurrence={onIgnoreRecurrenceMock}
        />,
      );

      const naoBtn = screen.getByRole("button", { name: /Não, foi pontual/i });
      fireEvent.click(naoBtn);

      const pontualOption = screen.getByText("É despesa pontual");
      fireEvent.click(pontualOption);

      expect(onIgnoreRecurrenceMock).toHaveBeenCalledWith("academia", "one_off");
      expect(triggerSensoryMock).toHaveBeenCalledWith("action");
    });

    it("ao selecionar 'Já cancelei' na calibração, executa onIgnoreRecurrence com already_cancelled e dispara sensory success", async () => {
      const onIgnoreRecurrenceMock = vi.fn().mockResolvedValue({});
      render(
        <SmartAdvisorCard
          insight={calibrationInsight}
          onIgnoreRecurrence={onIgnoreRecurrenceMock}
        />,
      );

      const naoBtn = screen.getByRole("button", { name: /Não, foi pontual/i });
      fireEvent.click(naoBtn);

      const cancelOption = screen.getByText("Já cancelei");
      fireEvent.click(cancelOption);

      expect(onIgnoreRecurrenceMock).toHaveBeenCalledWith("academia", "already_cancelled");
      expect(triggerSensoryMock).toHaveBeenCalledWith("success");
    });

    it("ao dispensar oportunidade de economia (savings), permite micro-feedback qualificado", async () => {
      const onIgnoreRecurrenceMock = vi.fn().mockResolvedValue({});
      render(
        <SmartAdvisorCard
          insight={savingsInsight}
          onIgnoreRecurrence={onIgnoreRecurrenceMock}
        />,
      );

      const dispensarBtn = screen.getByRole("button", { name: /^Dispensar$/i });
      fireEvent.click(dispensarBtn);

      const notSubOption = screen.getByText("Não é assinatura");
      fireEvent.click(notSubOption);

      expect(onIgnoreRecurrenceMock).toHaveBeenCalledWith("streaming-antigo", "not_subscription");
      expect(triggerSensoryMock).toHaveBeenCalledWith("action");
    });

    it("ao clicar em ação de navegação (Rever assinatura), navega para /insights?aba=recurrences com item selecionado", () => {
      render(<SmartAdvisorCard insight={savingsInsight} />);

      const actionBtn = screen.getByRole("button", { name: /Rever assinatura/i });
      fireEvent.click(actionBtn);

      expect(mockNavigate).toHaveBeenCalledWith("/insights?aba=recurrences&item=streaming-antigo");
      expect(triggerSensoryMock).toHaveBeenCalledWith("selection");
    });

    it("ao clicar em Realizar aporte, navega para a calculadora de aporte com o valor planejado preenchido", () => {
      render(<SmartAdvisorCard insight={aporteInsight} />);

      const actionBtn = screen.getByRole("button", { name: /Realizar aporte/i });
      fireEvent.click(actionBtn);

      expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=aporte&valor=120000");
    });

    it("ao clicar em Registrar pagamento, abre modal LaunchWizard pré-preenchido via query params", () => {
      const missingExpenseInsight: SmartAdvisorInsight = {
        id: "missing_expense:youtube",
        themeKey: "missing_expense:youtube",
        priority: 1,
        category: "critical",
        title: "Conta pendente no mês",
        description: "YouTube Premium costuma ser cobrada por volta do dia 10 e ainda não foi identificada no mês.",
        iconName: "alert-triangle",
        primaryAction: {
          label: "Registrar pagamento",
          kind: "register_expense",
          payload: {
            name: "YouTube Premium",
            valueCents: 3990,
            categoryId: "cat-stream",
            date: "2026-10-10",
            cardId: "card-nubank",
          },
        },
      };

      render(<SmartAdvisorCard insight={missingExpenseInsight} />);

      const actionBtn = screen.getByRole("button", { name: /Registrar pagamento/i });
      fireEvent.click(actionBtn);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("novo=despesa"),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("valor=3990"),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("descricao=YouTube+Premium"),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("categoria=cat-stream"),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("data=2026-10-10"),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("cartao=card-nubank"),
      );
    });

    it("quando renderizado sem props, consome insight do hook e executa hook.dismiss", () => {
      mockHookReturn.insight = criticalInsight;
      render(<SmartAdvisorCard />);

      expect(screen.getByText("Cobrança duplicada detectada")).toBeInTheDocument();
      const dismissBtn = screen.getByRole("button", { name: /Dispensar por 30 dias/i });
      fireEvent.click(dismissBtn);

      expect(mockHookDismiss).toHaveBeenCalledWith("dup:netflix");
    });

    it("não renderiza quando o mês informado for diferente do mês atual (histórico)", () => {
      mockHookReturn.insight = criticalInsight;
      const { container } = render(
        <SmartAdvisorCard month="2020-01" insight={criticalInsight} />,
      );

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText("Cobrança duplicada detectada")).not.toBeInTheDocument();
    });

    it("renderiza normalmente quando o mês informado for igual ao mês atual", () => {
      mockHookReturn.insight = criticalInsight;
      render(
        <SmartAdvisorCard month={new Date().toISOString().slice(0, 7)} insight={criticalInsight} />,
      );

      expect(screen.getByText("Cobrança duplicada detectada")).toBeInTheDocument();
    });

    it("não renderiza controles de navegação quando há apenas 1 insight (totalCount <= 1)", () => {
      render(
        <SmartAdvisorCard
          insight={criticalInsight}
          currentIndex={0}
          totalCount={1}
        />,
      );

      expect(screen.queryByLabelText("Sugestão anterior")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Próxima sugestão")).not.toBeInTheDocument();
      expect(screen.queryByText(/1 de 1/i)).not.toBeInTheDocument();
    });

    it("renderiza controles de navegação e indicador '1 de 3' quando totalCount > 1", () => {
      const handleNext = vi.fn();
      const handlePrev = vi.fn();

      render(
        <SmartAdvisorCard
          insight={criticalInsight}
          currentIndex={0}
          totalCount={3}
          onNext={handleNext}
          onPrev={handlePrev}
        />,
      );

      expect(screen.getByText("1 de 3")).toBeInTheDocument();
      const prevBtn = screen.getByLabelText("Sugestão anterior");
      const nextBtn = screen.getByLabelText("Próxima sugestão");

      fireEvent.click(nextBtn);
      expect(handleNext).toHaveBeenCalledTimes(1);

      fireEvent.click(prevBtn);
      expect(handlePrev).toHaveBeenCalledTimes(1);
    });

    it("chama hook.nextInsight e hook.prevInsight quando não injetados callbacks controlados", () => {
      mockHookReturn.insight = criticalInsight;
      mockHookReturn.totalCount = 2;
      mockHookReturn.currentIndex = 0;

      render(<SmartAdvisorCard />);

      expect(screen.getByText("1 de 2")).toBeInTheDocument();
      const nextBtn = screen.getByLabelText("Próxima sugestão");
      fireEvent.click(nextBtn);

      expect(mockHookNext).toHaveBeenCalledTimes(1);

      const prevBtn = screen.getByLabelText("Sugestão anterior");
      fireEvent.click(prevBtn);

      expect(mockHookPrev).toHaveBeenCalledTimes(1);
    });
  });
});
