import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  endDemo,
  getDemoSessionState,
  hasCompletedDemoTour,
  resetDemoSession,
  resetDemoTourStorage,
  startDemo,
} from "@/state/demo-mode";
import { DemoTourSpotlight } from "@/components/modules/demo-tour-spotlight";
import { FamilyPage } from "@/features/family/pages/family-page";
import { PendingSplitSignalsCard } from "@/components/modules/pending-split-signals-card";
import { BudgetsPage } from "@/features/budgets/pages/budgets-page";
import { StepDetails } from "@/features/transactions/wizard/step-details";
import { defaultLaunchState } from "@/features/transactions/wizard/wizard-state";
import { getTourSteps } from "@/domain/demo-simulation/tour-steps";
import { TOUR_TRACK_METAS } from "@/domain/demo-simulation/tour-catalog";
import type { TourTrackId } from "@/domain/demo-simulation/types";

// ---------------------------------------------------------------------------
// Mock de Infraestrutura & Roteador
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
let mockLocation = { pathname: "/", search: "" };

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

// Mock do cliente Supabase para auditar que ZERO chamadas são feitas no modo demo
const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseQuery),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  },
};

vi.mock("@/data/client", () => ({
  getSupabase: () => mockSupabaseClient,
}));

// Mocks auxiliares para permissão, subscription e user preferences nas páginas
vi.mock("@/state/queries/use-permission", () => ({
  usePermission: () => ({
    canRead: true,
    canWrite: true,
    isHidden: false,
    accessLevel: "admin",
    isReadOnlyMode: false,
  }),
}));

vi.mock("@/state/queries/use-user-subscription", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
}));

vi.mock("@/state/queries/use-user-preferences", () => ({
  useUserPreferences: () => ({
    data: {
      theme: "dark",
      custom_settings: {
        familyModeEnabled: true,
        primaryCardId: null,
        cardOrder: [],
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

function createWrapper(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Suíte Canônica: Testes E2E de Simulação (Vitest) — Tarefa 5.1
// ---------------------------------------------------------------------------

describe("Tarefa 5.1: Testes E2E de Simulação (Vitest) — Trilha de Finanças Compartilhadas & Tour Guiado", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    mockLocation = { pathname: "/", search: "" };
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    endDemo();
    resetDemoSession();
    cleanup();
    document.body.innerHTML = "";
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("1. Inicialização, Isolamento de Rede & Governança da Simulação", () => {
    it("inicia o modo de simulação com estado estrito em memória e sem acionar o cliente Supabase", () => {
      startDemo("shared_finances");

      const session = getDemoSessionState();
      expect(session.isDemoActive).toBe(true);
      expect(session.activeTrack).toBe("shared_finances");
      expect(session.currentStepIndex).toBe(0);

      // Audita que absolutamente nenhuma consulta ao banco de dados foi disparada
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("encerra o modo demo e restaura o estado limpo sem deixar resíduos", () => {
      startDemo("shared_finances");
      expect(getDemoSessionState().isDemoActive).toBe(true);

      endDemo();
      expect(getDemoSessionState().isDemoActive).toBe(false);
      expect(getDemoSessionState().activeTrack).toBeNull();
      expect(getDemoSessionState().currentStepIndex).toBe(0);
    });
  });

  describe("2. Renderização de Telas Reais no Modo Demo sem Falhas e sem Telas Vazias (DoD 1)", () => {
    it("Passo 1: Renderiza o assistente de lançamento com o switch de divisão de contas ativo", async () => {
      startDemo("shared_finances");
      const state = defaultLaunchState("expense", {
        valueCents: 15000,
        description: "Restaurante Confraternização",
      });

      const handleSplitToggle = vi.fn();

      render(
        <StepDetails
          state={state}
          onDateChange={vi.fn()}
          onPaymentMethodChange={vi.fn()}
          onCardChange={vi.fn()}
          onReceiveTypeChange={vi.fn()}
          onDescriptionChange={vi.fn()}
          onFamilyChange={vi.fn()}
          onReportWeightChange={vi.fn()}
          onReportCustomAmountChange={vi.fn()}
          onSplitToggle={handleSplitToggle}
          onSplitPeopleCountChange={vi.fn()}
          onDebtToggle={vi.fn()}
          onDebtTypeChange={vi.fn()}
          onDebtAmountChange={vi.fn()}
          onDebtDueDateChange={vi.fn()}
          onRecurringToggle={vi.fn()}
          onRecurrenceFrequencyChange={vi.fn()}
          onRecurrenceEndModeChange={vi.fn()}
          onRecurrenceEndDateChange={vi.fn()}
          onRecurrenceCountChange={vi.fn()}
          descriptionSuggestions={[]}
          cards={[]}
          cardsLoading={false}
          cardsError={null}
        />,
        { wrapper: createWrapper() },
      );

      // Valida o botão com o seletor do tour
      const splitTarget = document.querySelector('[data-tour="wizard-split-toggle"]');
      expect(splitTarget).toBeInTheDocument();
      expect(splitTarget).toHaveTextContent("Rachar c/ Amigos");

      // Ao selecionar Rachar c/ Amigos, ativa imediatamente a divisão sem switches redundantes
      await userEvent.click(splitTarget!);
      expect(handleSplitToggle).toHaveBeenCalledWith(true);

      // Zero chamadas ao Supabase
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("Passo 2: Renderiza o card de cobranças Pix pendentes no Dashboard com dados simulados ricos", async () => {
      startDemo("shared_finances");

      render(<PendingSplitSignalsCard />, { wrapper: createWrapper() });

      // Valida presença do card com o seletor canônico do tour
      await waitFor(() => {
        const cardTarget = document.querySelector('[data-tour="split-pending-card"]');
        expect(cardTarget).toBeInTheDocument();
      });

      // Valida os participantes e status sinalizados do dataset mockado
      expect(screen.getAllByText("Churrasco de Confraternização").length).toBeGreaterThan(0);
      expect(screen.getByText("Mariana Costa")).toBeInTheDocument();
      expect(screen.getByText("Lucas Oliveira")).toBeInTheDocument();

      // Valida contagem de pagamentos pendentes de confirmação
      expect(screen.getByText("Pagamento de Racha Sinalizado")).toBeInTheDocument();
      expect(screen.getByText(/2 avisos/i)).toBeInTheDocument();

      // Zero chamadas ao banco
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("Passo 3: Renderiza o Hub Familiar (/familia) sem redirecionar e com os cards de teto e equilíbrio ativos", async () => {
      startDemo("shared_finances");
      mockLocation = { pathname: "/familia", search: "" };

      render(<FamilyPage />, { wrapper: createWrapper() });

      // Valida que o cabeçalho e os seletores alvos do tour foram renderizados
      await waitFor(() => {
        expect(screen.getByText("Modo Família")).toBeInTheDocument();
        expect(screen.getByText("Família Silva")).toBeInTheDocument();
      });

      // Valida a presença dos cards destacados no tour
      const ceilingCard = document.querySelector('[data-tour="family-ceiling-card"]');
      const balanceCard = document.querySelector('[data-tour="family-balance-card"]');

      expect(ceilingCard).toBeInTheDocument();
      expect(balanceCard).toBeInTheDocument();

      // Valida que não renderizou EmptyState de criação
      expect(
        screen.queryByText("Você ainda não faz parte de uma família"),
      ).not.toBeInTheDocument();

      // Zero chamadas ao banco
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("Passo 4: Renderiza Metas e Vaquinhas Coletivas (/orcamentos?tab=goals) com termômetro e dados do mock", async () => {
      startDemo("shared_finances");
      mockLocation = { pathname: "/orcamentos", search: "?tab=goals" };

      render(<BudgetsPage />, { wrapper: createWrapper(["/orcamentos?tab=goals"]) });

      // Valida que o banner e o card alvo do tour estão no DOM
      await waitFor(() => {
        const banner = document.querySelector('[data-tour="shared-goals-banner"]');
        const card = document.querySelector('[data-tour="shared-goals-card"]');
        expect(banner).toBeInTheDocument();
        expect(card).toBeInTheDocument();
      });

      // Valida que a campanha simulada 'Viagem de Fim de Ano em Família' está visível
      expect(screen.getByText("Viagem de Fim de Ano em Família")).toBeInTheDocument();
      expect(screen.getByText(/1 ativa/i)).toBeInTheDocument();

      // Zero chamadas ao banco
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe("3. Fluxo Integrado do Spotlight de Ponta a Ponta na Trilha 4 (shared_finances)", () => {
    it("navega sequencialmente pelos 4 passos com botões de ação e conclui o tour restaurando o foco (DoD 1 & DoD 2)", async () => {
      const user = userEvent.setup();

      // Cria botão gatilho para auditar a restauração de foco acessível
      const triggerButton = document.createElement("button");
      triggerButton.textContent = "Iniciar Apresentação";
      document.body.appendChild(triggerButton);
      triggerButton.focus();
      expect(document.activeElement).toBe(triggerButton);

      // Inicia a trilha de finanças compartilhadas
      startDemo("shared_finances");

      const handleNextStep = vi.fn();
      const handleClose = vi.fn();

      const { rerender } = render(
        <DemoTourSpotlight onNextStep={handleNextStep} onClose={handleClose} />,
      );

      // PASSO 1: Lançamento Compartilhado e Modo Família
      expect(screen.getByText("Passo 1 de 4")).toBeInTheDocument();
      expect(screen.getByText("Lançamento Compartilhado e Modo Família")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Passo anterior|Anterior/i })).toBeDisabled();

      const step1NextBtn = screen.getByRole("button", { name: /Próximo passo|Próximo/i });
      await user.click(step1NextBtn);

      expect(getDemoSessionState().currentStepIndex).toBe(1);
      expect(mockNavigate).toHaveBeenCalledWith("/");
      expect(handleNextStep).toHaveBeenCalledWith(1);

      // Simula navegação do router para o Passo 2
      mockLocation = { pathname: "/", search: "" };
      rerender(<DemoTourSpotlight onNextStep={handleNextStep} onClose={handleClose} />);

      // PASSO 2: Rachas Ativos e Cobrança Pix
      expect(screen.getByText("Passo 2 de 4")).toBeInTheDocument();
      expect(
        screen.getByText(/Rachas Ativos e Cobrança Pix|Divisões Pendentes e Cobrança Pix/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Passo anterior|Anterior/i })).not.toBeDisabled();

      const step2NextBtn = screen.getByRole("button", { name: /Próximo passo|Próximo/i });
      await user.click(step2NextBtn);

      expect(getDemoSessionState().currentStepIndex).toBe(2);
      expect(mockNavigate).toHaveBeenCalledWith("/familia");
      expect(handleNextStep).toHaveBeenCalledWith(2);

      // Simula navegação do router para o Passo 3
      mockLocation = { pathname: "/familia", search: "" };
      rerender(<DemoTourSpotlight onNextStep={handleNextStep} onClose={handleClose} />);

      // PASSO 3: Teto Compartilhado e Equilíbrio da Casa
      expect(screen.getByText("Passo 3 de 4")).toBeInTheDocument();
      expect(screen.getByText(/Teto Compartilhado e Equilíbrio/i)).toBeInTheDocument();

      const step3NextBtn = screen.getByRole("button", { name: /Próximo passo|Próximo/i });
      await user.click(step3NextBtn);

      expect(getDemoSessionState().currentStepIndex).toBe(3);
      expect(mockNavigate).toHaveBeenCalledWith("/orcamentos?tab=goals");
      expect(handleNextStep).toHaveBeenCalledWith(3);

      // Simula navegação do router para o Passo 4
      mockLocation = { pathname: "/orcamentos", search: "?tab=goals" };
      rerender(<DemoTourSpotlight onNextStep={handleNextStep} onClose={handleClose} />);

      // PASSO 4: Termômetro Coletivo e Vaquinha Pix
      expect(screen.getByText("Passo 4 de 4")).toBeInTheDocument();
      expect(screen.getByText(/Termômetro Coletivo|Metas Coletivas/i)).toBeInTheDocument();

      const finishBtn = screen.getByRole("button", { name: /Começar/i });
      expect(finishBtn).toBeInTheDocument();
      await user.click(finishBtn);

      // Valida finalização da sessão e registro de conclusão
      expect(getDemoSessionState().isDemoActive).toBe(false);
      expect(hasCompletedDemoTour("shared_finances")).toBe(true);
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Valida restauração estrita do foco para o gatilho original (DoD 2)
      expect(document.activeElement).toBe(triggerButton);
    });

    it("permite encerramento antecipado pelo botão fechar [X] com restauração de foco", async () => {
      const user = userEvent.setup();

      const triggerButton = document.createElement("button");
      triggerButton.textContent = "Abrir";
      document.body.appendChild(triggerButton);
      triggerButton.focus();

      startDemo("shared_finances");

      render(<DemoTourSpotlight />);

      expect(screen.getByText("Passo 1 de 4")).toBeInTheDocument();

      const closeBtn = screen.getByRole("button", { name: /Encerrar tour demonstrativo/i });
      await user.click(closeBtn);

      expect(getDemoSessionState().isDemoActive).toBe(false);
      expect(document.activeElement).toBe(triggerButton);
    });
  });

  describe("4. Validação E2E dos Micro-Tours Sociais", () => {
    const microTours: Array<{
      track: TourTrackId;
      expectedSteps: number;
      expectedFirstTitle: string;
      expectedFirstRoute: string;
    }> = [
      {
        track: "finances_split",
        expectedSteps: 6,
        expectedFirstTitle: "Onde Fica o Racha & Divisão no Lançamento",
        expectedFirstRoute:
          "/transacoes?novo=despesa&passo=3&racha=1&valor=48000&descricao=Churrasco+de+Confraternizacao",
      },
      {
        track: "finances_family",
        expectedSteps: 2,
        expectedFirstTitle: "Teto Orçamentário da Família",
        expectedFirstRoute: "/familia",
      },
      {
        track: "finances_goals",
        expectedSteps: 2,
        expectedFirstTitle: "Metas Coletivas e Vaquinhas Pix",
        expectedFirstRoute: "/orcamentos?tab=goals",
      },
    ];

    microTours.forEach(({ track, expectedSteps, expectedFirstTitle, expectedFirstRoute }) => {
      it(`Micro-tour '${track}': executa os ${expectedSteps} passos com sucesso e sem requisições de rede`, async () => {
        const user = userEvent.setup();
        startDemo(track);

        const steps = getTourSteps(track);
        expect(steps.length).toBe(expectedSteps);
        expect(steps[0]?.targetRoute).toBe(expectedFirstRoute);

        const { rerender } = render(<DemoTourSpotlight />);

        expect(screen.getByText(`Passo 1 de ${expectedSteps}`)).toBeInTheDocument();
        expect(screen.getByText(expectedFirstTitle)).toBeInTheDocument();

        // Avança até o último passo
        for (let i = 0; i < expectedSteps - 1; i++) {
          const nextBtn = screen.getByRole("button", { name: /Próximo passo|Próximo/i });
          await user.click(nextBtn);

          const nextStep = steps[i + 1];
          if (nextStep) {
            const [path, query] = nextStep.targetRoute.split("?");
            mockLocation = { pathname: path ?? "/", search: query ? `?${query}` : "" };
          }
          rerender(<DemoTourSpotlight />);
        }

        // Conclui o micro-tour
        const finishBtn = screen.getByRole("button", { name: /Começar/i });
        await user.click(finishBtn);

        expect(getDemoSessionState().isDemoActive).toBe(false);
        expect(hasCompletedDemoTour(track)).toBe(true);
        expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      });
    });
  });

  describe("5. Auditoria de Acessibilidade, Tokens de Design e Zero Emojis", () => {
    it("garante que nenhum texto da trilha de simulação contém emojis ou caracteres decorativos proibidos", () => {
      const steps = getTourSteps("shared_finances");
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      steps.forEach((step) => {
        expect(step.title).not.toMatch(emojiRegex);
        expect(step.description).not.toMatch(emojiRegex);
        if (step.titleDesktop) expect(step.titleDesktop).not.toMatch(emojiRegex);
        if (step.contentDesktop) expect(step.contentDesktop).not.toMatch(emojiRegex);
      });
    });

    it("metadados do catálogo de trilhas estão perfeitamente registrados e consistentes", () => {
      const sharedMeta = TOUR_TRACK_METAS.shared_finances;
      expect(sharedMeta).toBeDefined();
      expect(sharedMeta.stepsCount).toBe(4);
      expect(sharedMeta.category).toBe("shared");
      expect(sharedMeta.startRoute).toBe("/");
    });
  });
});
