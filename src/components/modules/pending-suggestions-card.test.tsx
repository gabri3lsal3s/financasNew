import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedBankTransaction } from "@/domain/notifications";
import * as nativeModule from "@/services/native";
import * as toastModule from "@/services/toast";
import { PendingSuggestionsCard } from "./pending-suggestions-card";

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockCreateExpenseMutateAsync = vi.fn().mockResolvedValue("exp_created_123");
const mockDeleteExpenseMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockCreateIncomeMutateAsync = vi.fn().mockResolvedValue({ id: "inc_created_456" });
const mockDeleteIncomeMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat_mercado", name: "Mercado", type: "expense", icon: "mercado", color: "#10b981", is_active: true, is_reserved: false },
      { id: "cat_alimentacao", name: "Alimentação", type: "expense", icon: "alimentacao", color: "#f59e0b", is_active: true, is_reserved: false },
      { id: "cat_salario", name: "Salário", type: "income", icon: "salario", color: "#3b82f6", is_active: true, is_reserved: false },
    ],
    isLoading: false,
    error: null,
  }),
  useActiveCreditCards: () => ({
    data: [
      { id: "card_nu", name: "Nubank Ultravioleta", closing_day: 10, is_active: true },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateExpense: () => ({
    mutateAsync: mockCreateExpenseMutateAsync,
    isPending: false,
  }),
  useDeleteExpense: () => ({
    mutateAsync: mockDeleteExpenseMutateAsync,
    isPending: false,
  }),
  useCreateIncome: () => ({
    mutateAsync: mockCreateIncomeMutateAsync,
    isPending: false,
  }),
  useCreateIncomeInstallments: () => ({
    mutateAsync: vi.fn().mockResolvedValue("inc_group_1"),
    isPending: false,
  }),
  useDeleteIncome: () => ({
    mutateAsync: mockDeleteIncomeMutateAsync,
    isPending: false,
  }),
}));

function renderCard(ui = <PendingSuggestionsCard />) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>,
  );
}

describe("PendingSuggestionsCard (Card de Sugestões de Compras & Pix)", () => {
  const sampleSuggestions: ParsedBankTransaction[] = [
    {
      id: "sug_1",
      bankName: "Nubank",
      nature: "expense",
      type: "expense",
      amountCents: 5290,
      description: "Supermercado Pão de Açúcar",
      categorySlug: "mercado",
      date: "2026-10-15",
      paymentMethod: "credit_card",
      rawText: "Compra de R$ 52,90 aprovada",
      timestamp: Date.now(),
    },
    {
      id: "sug_2",
      bankName: "Inter",
      nature: "income",
      type: "income",
      amountCents: 12000,
      description: "Pix de Mariana Lima",
      date: "2026-10-15",
      paymentMethod: "pix",
      rawText: "Você recebeu um Pix de R$ 120,00",
      timestamp: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza nada quando não há sugestões pendentes", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([]);
    const { container } = renderCard();
    expect(container.firstChild).toBeNull();
  });

  it("renderiza lista de sugestões com informações formatadas e badges", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue(sampleSuggestions);
    renderCard();

    expect(screen.getByText("Transações Detectadas")).toBeInTheDocument();
    expect(screen.getByText("2 pendentes")).toBeInTheDocument();
    expect(screen.getByText("Supermercado Pão de Açúcar")).toBeInTheDocument();
    expect(screen.getByText("Pix de Mariana Lima")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText("Inter")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Salvar Rápido/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Revisar/i })).toHaveLength(2);
  });

  it("chama dismissPendingSuggestion ao clicar em Descartar", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([sampleSuggestions[0]!]);
    const dismissSpy = vi.spyOn(nativeModule, "dismissPendingSuggestion").mockImplementation(() => {});

    renderCard();

    const discardBtn = screen.getByRole("button", { name: /Descartar sugestão/i });
    fireEvent.click(discardBtn);

    expect(dismissSpy).toHaveBeenCalledWith("sug_1");
  });

  it("navega para o formulário pré-preenchido ao clicar em Revisar", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([sampleSuggestions[0]!]);

    renderCard();

    const reviewBtn = screen.getByRole("button", { name: /Revisar sugestão/i });
    fireEvent.click(reviewBtn);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("novo=expense&valor=5290&descricao=Supermercado+P%C3%A3o+de+A%C3%A7%C3%BAcar"),
    );
  });

  it("permite descartar todas as sugestões quando houver 2 ou mais", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue(sampleSuggestions);
    const clearSpy = vi.spyOn(nativeModule, "clearPendingSuggestions").mockImplementation(() => {});

    renderCard();

    const discardAllBtn = screen.getByRole("button", { name: /Descartar todas/i });
    fireEvent.click(discardAllBtn);

    expect(clearSpy).toHaveBeenCalled();
  });

  describe("Ação Rápida de 1-Clique e Toast de Desfazer (§3.2)", () => {
    it("executa Salvar Rápido criando despesa no Supabase e emitindo Toast com ação Desfazer", async () => {
      vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([sampleSuggestions[0]!]);
      const dismissSpy = vi.spyOn(nativeModule, "dismissPendingSuggestion").mockImplementation(() => {});
      const pushToastSpy = vi.spyOn(toastModule, "pushToast");

      renderCard();

      const quickSaveBtn = screen.getByRole("button", {
        name: `Salvar rápido sugestão de ${sampleSuggestions[0]!.description}`,
      });
      fireEvent.click(quickSaveBtn);

      // Mutação executada diretamente
      await waitFor(() => {
        expect(mockCreateExpenseMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 52.9,
            categoryId: "cat_mercado",
            paymentMethod: "credit_card",
            cardId: "card_nu",
          }),
        );
      });

      // Descartado da fila
      expect(dismissSpy).toHaveBeenCalledWith("sug_1");

      // Toast com duração de 5000ms e ação Desfazer
      await waitFor(() => {
        expect(pushToastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/Despesa de R\$\s*52,90 salva em Mercado/),
            variant: "success",
            duration: 5000,
            action: expect.objectContaining({
              label: "Desfazer",
              onClick: expect.any(Function),
            }),
          }),
        );
      });
    });

    it("ao acionar o botão Desfazer do Toast, remove a transação criada e restaura a sugestão na fila", async () => {
      vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([sampleSuggestions[0]!]);
      const addPendingSpy = vi.spyOn(nativeModule, "addPendingSuggestion").mockImplementation(() => {});
      let capturedUndoAction: (() => void) | undefined;

      vi.spyOn(toastModule, "pushToast").mockImplementation((req) => {
        if (req.action) {
          capturedUndoAction = req.action.onClick;
        }
        return 1;
      });

      renderCard();

      const quickSaveBtn = screen.getByRole("button", {
        name: `Salvar rápido sugestão de ${sampleSuggestions[0]!.description}`,
      });
      fireEvent.click(quickSaveBtn);

      await waitFor(() => {
        expect(capturedUndoAction).toBeDefined();
      });

      // Executa a ação de desfazer
      capturedUndoAction!();

      // Transação excluída no banco
      await waitFor(() => {
        expect(mockDeleteExpenseMutateAsync).toHaveBeenCalledWith({
          expenseId: "exp_created_123",
          mode: "single",
        });
      });

      // Notificação reinserida na fila
      expect(addPendingSpy).toHaveBeenCalledWith(sampleSuggestions[0]);
    });

    it("permite troca inline de categoria através do Popover sem abrir modal", async () => {
      const user = userEvent.setup();
      vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([sampleSuggestions[0]!]);

      renderCard();

      const categoryBadge = screen.getByRole("button", {
        name: `Trocar categoria da sugestão ${sampleSuggestions[0]!.description}`,
      });
      expect(categoryBadge).toHaveTextContent("Mercado");

      // Abre popover inline
      await user.click(categoryBadge);

      expect(screen.getByText("Trocar categoria")).toBeInTheDocument();
      const alimentacaoOption = screen.getByRole("button", { name: /Alimentação/i });

      // Seleciona Alimentação
      await user.click(alimentacaoOption);

      // Badge deve ter atualizado inline para Alimentação
      expect(categoryBadge).toHaveTextContent("Alimentação");
    });
  });

  describe("Roteamento Inteligente de Investimentos (§3.3)", () => {
    const investmentSuggestion: ParsedBankTransaction = {
      id: "sug_inv_1",
      bankName: "BTG Investimentos",
      nature: "investment",
      type: "expense",
      investmentSubtype: "contribution",
      amountCents: 150000,
      description: "Aplicação Tesouro Selic 2029",
      date: "2026-08-16",
      assetTicker: "LFT",
      rawText: "Aplicação realizada com sucesso",
      timestamp: 1729000000000,
    };

    const dividendSuggestion: ParsedBankTransaction = {
      id: "sug_inv_2",
      bankName: "Rico",
      nature: "investment",
      type: "income",
      investmentSubtype: "dividend",
      amountCents: 4500,
      description: "Rendimento FII MXRF11",
      date: "2026-08-16",
      assetTicker: "MXRF11",
      rawText: "Você recebeu rendimentos de MXRF11",
      timestamp: 1729000000000,
    };

    it("renderiza badges específicos (Investimento / Provento, Ticker) e botões adaptados para sugestão de investimento", () => {
      vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([
        investmentSuggestion,
        dividendSuggestion,
      ]);

      renderCard();

      // Badges
      expect(screen.getByText("Investimento")).toBeInTheDocument();
      expect(screen.getByText("LFT")).toBeInTheDocument();
      expect(screen.getByText("Provento")).toBeInTheDocument();
      expect(screen.getByText("MXRF11")).toBeInTheDocument();

      // Botões adaptados
      const registerButtons = screen.getAllByRole("button", { name: /Registrar aporte ou provento/i });
      expect(registerButtons).toHaveLength(2);
      expect(registerButtons[0]).toHaveTextContent("Registrar Aporte / Provento");

      const saveAsStandardButtons = screen.getAllByRole("button", { name: /Salvar como despesa ou renda/i });
      expect(saveAsStandardButtons).toHaveLength(2);
      expect(saveAsStandardButtons[0]).toHaveTextContent("Salvar como Despesa/Renda");

      // Botões normais ("Salvar Rápido" e "Revisar") não devem aparecer para investimentos
      expect(screen.queryByRole("button", { name: /^Salvar rápido/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Revisar/i })).not.toBeInTheDocument();
    });

    it("ao clicar em Registrar Aporte / Provento para aporte, descarta a sugestão e redireciona para /investimentos com tab=aporte e parâmetros preenchidos", () => {
      vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([investmentSuggestion]);
      const dismissSpy = vi.spyOn(nativeModule, "dismissPendingSuggestion").mockImplementation(() => {});

      renderCard();

      const registerBtn = screen.getByRole("button", {
        name: `Registrar aporte ou provento da sugestão ${investmentSuggestion.description}`,
      });
      fireEvent.click(registerBtn);

      expect(dismissSpy).toHaveBeenCalledWith("sug_inv_1");
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/^\/investimentos\?.*tab=aporte.*valor=150000.*ticker=LFT.*data=2026-08-16/),
      );
    });

    it("ao clicar em Registrar Aporte / Provento para provento, descarta a sugestão e redireciona para /investimentos com tab=proventos e parâmetros preenchidos", () => {
      vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([dividendSuggestion]);
      const dismissSpy = vi.spyOn(nativeModule, "dismissPendingSuggestion").mockImplementation(() => {});

      renderCard();

      const registerBtn = screen.getByRole("button", {
        name: `Registrar aporte ou provento da sugestão ${dividendSuggestion.description}`,
      });
      fireEvent.click(registerBtn);

      expect(dismissSpy).toHaveBeenCalledWith("sug_inv_2");
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/^\/investimentos\?.*tab=proventos.*valor=4500.*ticker=MXRF11.*data=2026-08-16/),
      );
    });

    it("ao clicar em Salvar como Despesa/Renda, persiste a transação como despesa/renda comum e emite Toast com Desfazer", async () => {
      vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([investmentSuggestion]);
      const dismissSpy = vi.spyOn(nativeModule, "dismissPendingSuggestion").mockImplementation(() => {});
      const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);

      renderCard();

      const saveBtn = screen.getByRole("button", {
        name: `Salvar como despesa ou renda sugestão de ${investmentSuggestion.description}`,
      });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateExpenseMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 1500,
            date: "2026-08-16",
            description: "Aplicação Tesouro Selic 2029",
          }),
        );
      });

      expect(dismissSpy).toHaveBeenCalledWith("sug_inv_1");

      await waitFor(() => {
        expect(pushToastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/Despesa de R\$\s*1\.500,00 salva/),
            variant: "success",
            duration: 5000,
            action: expect.objectContaining({
              label: "Desfazer",
            }),
          }),
        );
      });
    });
  });
});
