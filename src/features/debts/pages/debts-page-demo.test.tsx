import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endDemo, resetDemoSession, startDemo } from "@/state/demo-mode";
import { DebtsPage } from "./debts-page";

// Mock das permissões e assinatura para visualização completa
vi.mock("@/state/queries/use-permission", () => ({
  usePermission: () => ({
    isHidden: false,
    canRead: true,
    canWrite: true,
    isReadOnlyMode: false,
    accessLevel: "admin",
  }),
}));

vi.mock("@/state/queries/use-user-subscription", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
}));

function createWrapper(initialUrl: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("DebtsPage no Modo Demo / Micro-Tour Contas & Dívidas", () => {
  beforeEach(() => {
    resetDemoSession();
  });

  afterEach(() => {
    endDemo();
    resetDemoSession();
  });

  it("no Passo 1 (Pagar), renderiza resumo, urgências e contas a pagar sem EmptyState", async () => {
    startDemo("finances_debts");

    render(<DebtsPage />, { wrapper: createWrapper("/debts?type=payable") });

    // 1. Alvo do tour no DOM
    const targetSection = document.querySelector('[data-tour="debts-payable-section"]');
    expect(targetSection).toBeInTheDocument();

    // 2. Não exibe estado vazio
    expect(screen.queryByText("Nenhuma conta a pagar")).not.toBeInTheDocument();

    // 3. Exibe resumo financeiro consolidado
    expect(screen.getByText("A pagar")).toBeInTheDocument();
    expect(screen.getByText("A receber")).toBeInTheDocument();
    expect(screen.getByText("Saldo pendente")).toBeInTheDocument();

    // 4. Exibe contas simuladas
    await waitFor(() => {
      expect(screen.getByText("Energia Elétrica (Enel)")).toBeInTheDocument();
      expect(screen.getByText("Internet Fibra Residencial")).toBeInTheDocument();
    });
  });

  it("no Passo 2 (Receber), renderiza contas a receber sem EmptyState", async () => {
    startDemo("finances_debts");

    render(<DebtsPage />, { wrapper: createWrapper("/debts?type=receivable") });

    // 1. Alvo do tour no DOM
    const targetSection = document.querySelector('[data-tour="debts-receivable-section"]');
    expect(targetSection).toBeInTheDocument();

    // 2. Não exibe estado vazio
    expect(screen.queryByText("Nenhuma conta a receber")).not.toBeInTheDocument();

    // 3. Exibe contas a receber simuladas
    await waitFor(() => {
      expect(screen.getByText("Consultoria de TI & Suporte Técnico")).toBeInTheDocument();
      expect(screen.getByText("Racha Churrasco (Lucas Oliveira)")).toBeInTheDocument();
    });
  });

  it("no Passo 3 (Contratos), renderiza os contratos SAC e Price sem EmptyState", async () => {
    startDemo("finances_debts");

    render(<DebtsPage />, { wrapper: createWrapper("/debts?type=loans") });

    // 1. Alvo do tour no DOM
    const targetSection = document.querySelector('[data-tour="debts-loans-section"]');
    expect(targetSection).toBeInTheDocument();

    // 2. Não exibe estado vazio
    expect(screen.queryByText("Nenhum contrato cadastrado")).not.toBeInTheDocument();

    // 3. Exibe os contratos de crédito e financiamento simulados com progresso de parcelas
    await waitFor(() => {
      expect(screen.getByText("Financiamento Imobiliário Residencial")).toBeInTheDocument();
      expect(screen.getByText("Financiamento Veicular - Honda Civic")).toBeInTheDocument();
    });

    // 4. Exibe os sistemas de amortização
    expect(screen.getByText(/Tabela SAC/i)).toBeInTheDocument();
    expect(screen.getByText(/Tabela Price/i)).toBeInTheDocument();
  });
});
