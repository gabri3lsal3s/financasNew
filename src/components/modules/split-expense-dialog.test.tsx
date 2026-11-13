import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SplitExpenseDialog } from "./split-expense-dialog";
import { storeSplitPreferences } from "@/services/split-preferences";
import type { Expense } from "@/types";

const mockMutateAsync = vi.fn();
vi.mock("@/state/mutations/use-public-share-mutations", () => ({
  useCreatePublicShare: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

const MOCK_PROFILE = {
  id: "user-123",
  name: "Gabriel Silva",
  email: "gabriel@example.com",
  cpf: "12345678901",
  created_at: "2026-01-01T00:00:00Z",
};

vi.mock("@/state/queries/use-user-access", () => ({
  useUserAccess: () => ({
    profile: MOCK_PROFILE,
  }),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}

const mockExpense: Expense = {
  id: "exp-123",
  user_id: "user-123",
  category_id: "cat-1",
  payment_method: "pix",
  card_id: null,
  value: 90.0, // R$ 90,00 -> 9000 centavos
  description: "Pizza com Amigos",
  date: "2026-11-05",
  installment_number: 1,
  installments_total: 1,
  installment_group_id: null,
  charge_kind: "regular",
  recurrence_id: null,
  bill_competence: null,
  report_weight: 1,
  base_amount: 90.0,
  created_at: "2026-11-05T12:00:00Z",
};

describe("SplitExpenseDialog", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({
      id: "share-123",
      token: "tok1234567",
      kind: "split",
      payload: {},
    });

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
  });

  it("renderiza campos com dados preenchidos a partir da despesa e perfil", () => {
    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        expense={mockExpense}
      />,
    );

    expect(screen.getByText("Rachar Despesa")).toBeInTheDocument();
    // Descrição preenchida
    const descInput = screen.getByLabelText("Descrição do racha");
    expect(descInput).toHaveValue("Pizza com Amigos");

    // Chave Pix preenchida do perfil (CPF)
    const pixInput = screen.getByLabelText("Chave Pix do anfitrião");
    expect(pixInput).toHaveValue("12345678901");

    // Titular preenchido
    const merchantInput = screen.getByLabelText("Nome do titular da chave Pix");
    expect(merchantInput).toHaveValue("Gabriel Silva");

    // Botão de ação visível
    expect(screen.getByText("Gerar Racha & Copiar Link")).toBeInTheDocument();
  });

  it("calcula rateio inicial de 2 pessoas corretamente", () => {
    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        expense={mockExpense}
      />,
    );

    // R$ 90,00 dividido em 2 pessoas = R$ 45,00 cada
    expect(screen.getByText("Cada Convidado (1)")).toBeInTheDocument();
    const shareValues = screen.getAllByText(/45,00/);
    expect(shareValues.length).toBeGreaterThanOrEqual(1);
  });

  it("atualiza rateio quando o número de participantes é alterado pelos botões rápidos", () => {
    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        expense={mockExpense}
      />,
    );

    // Clica em "3 pessoas" (R$ 90,00 / 3 = R$ 30,00)
    const btn3 = screen.getByRole("button", { name: "3 pessoas" });
    fireEvent.click(btn3);

    expect(screen.getByText("Cada Convidado (2)")).toBeInTheDocument();
    const shareValues = screen.getAllByText(/30,00/);
    expect(shareValues.length).toBeGreaterThanOrEqual(1);
  });

  it("permite alternar para modo de nomes customizados e adicionar participante", () => {
    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        expense={mockExpense}
      />,
    );

    // Alterna para "Nomes Customizados"
    const customModeBtn = screen.getByRole("button", { name: "Nomes Customizados" });
    fireEvent.click(customModeBtn);

    expect(screen.getByLabelText("Nome do participante 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do participante 2")).toBeInTheDocument();

    // Adiciona participante
    const addBtn = screen.getByRole("button", { name: "Adicionar participante" });
    fireEvent.click(addBtn);

    expect(screen.getByLabelText("Nome do participante 3")).toBeInTheDocument();
  });

  it("respeita preferências salvas de Pix e cidade em vez dos dados do perfil", () => {
    storeSplitPreferences({
      pixKey: "minhachave@salva.com",
      pixKeyType: "email",
      merchantName: "Gabriel Personalizado",
      merchantCity: "CURITIBA",
    });

    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        expense={mockExpense}
      />,
    );

    expect(screen.getByLabelText("Chave Pix do anfitrião")).toHaveValue("minhachave@salva.com");
    expect(screen.getByLabelText("Nome do titular da chave Pix")).toHaveValue("Gabriel Personalizado");
    expect(screen.getByLabelText("Cidade do titular da chave Pix")).toHaveValue("CURITIBA");
  });

  it("gera racha, chama mutation, copia link e exibe tela de sucesso com botão WhatsApp", async () => {
    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        expense={mockExpense}
      />,
    );

    const cityInput = screen.getByLabelText("Cidade do titular da chave Pix");
    fireEvent.change(cityInput, { target: { value: "NOSSA SENHORA DA GLORIA" } });

    const submitBtn = screen.getByRole("button", { name: /Gerar Racha & Copiar Link/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    const firstCall = mockMutateAsync.mock.calls[0];
    expect(firstCall).toBeDefined();
    const callArg = firstCall![0];
    expect(callArg.kind).toBe("split");
    expect(callArg.payload.total_cents).toBe(9000);
    expect(callArg.payload.guest_share_cents).toBe(4500);
    expect(callArg.payload.host_city).toBe("NOSSA SENHORA DA GLORIA");
    expect(callArg.payload.pix_br_code).toBeDefined();

    // Link copiado para clipboard
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/r/tok1234567"),
    );

    // Tela de sucesso exibida
    expect(screen.getByText("Link de Racha Gerado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
  });

  it("auto-gera o racha quando autoGenerate for true e cidade estiver preenchida", async () => {
    storeSplitPreferences({
      merchantCity: "ARACAJU",
    });

    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        expense={mockExpense}
        autoGenerate={true}
      />,
    );

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Link de Racha Gerado")).toBeInTheDocument();
  });

  it("gera racha parcelado com participant_installments quando a despesa for parcelada", async () => {
    storeSplitPreferences({
      merchantCity: "ARACAJU",
    });

    const installmentExpense: Expense = {
      ...mockExpense,
      value: 300,
      installments_total: 3,
    };

    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        expense={installmentExpense}
      />,
    );

    const generateBtn = screen.getByRole("button", { name: /Gerar Racha & Copiar Link/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            installments_count: 3,
            installments_mode: "per_installment",
            participant_installments: expect.arrayContaining([
              expect.objectContaining({
                participant_id: "p_2",
                installment_number: 1,
                is_settled: false,
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("fecha o diálogo ao clicar em Cancelar", () => {
    const onOpenChange = vi.fn();
    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={onOpenChange}
        expense={mockExpense}
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renderiza modo simplificado sem duplicidade quando acionado a partir do Wizard (fromWizard)", async () => {
    renderWithClient(
      <SplitExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        fromWizard={true}
        expense={mockExpense}
        initialPeopleCount={3}
      />,
    );

    // Título focado em Chave Pix & Link
    expect(screen.getByText("Chave Pix & Link do Racha")).toBeInTheDocument();
    expect(screen.getByText(/Rateio já registrado no seu extrato/i)).toBeInTheDocument();

    // NÃO deve exibir os botões de seleção rápida de participantes (2, 3, 4, 5 pessoas)
    expect(screen.queryByRole("button", { name: "2 pessoas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "3 pessoas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "4 pessoas" })).not.toBeInTheDocument();

    // Não deve ter input para redigitar valor total
    expect(screen.queryByLabelText("Valor total da despesa")).not.toBeInTheDocument();

    // Deve exibir o resumo da partilha
    expect(screen.getByText(/3 pessoas \(2 amigos \+ você\)/i)).toBeInTheDocument();

    // Botão focado em gerar link e copiar Pix
    const generateBtn = screen.getByRole("button", { name: /Gerar Link & Copiar Pix/i });
    expect(generateBtn).toBeInTheDocument();

    // Permite expandir nomes dos participantes sem mudar a contagem
    const toggleNamesBtn = screen.getByRole("button", { name: /Personalizar nomes dos participantes/i });
    fireEvent.click(toggleNamesBtn);
    expect(screen.getByPlaceholderText("Você (Anfitrião)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Amigo 1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Amigo 2")).toBeInTheDocument();
  });
});
