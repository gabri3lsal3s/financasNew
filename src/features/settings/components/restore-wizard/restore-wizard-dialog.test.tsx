import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RestoreWizardDialog } from "./restore-wizard-dialog";
import { buildBackupPayload, type BackupData } from "@/domain/export";

const mockMutateAsync = vi.fn();
vi.mock("@/state", () => ({
  useRestoreBackup: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

const mockFetchAllUserData = vi.fn();
vi.mock("@/data/repositories/export", () => ({
  fetchAllUserData: () => mockFetchAllUserData(),
}));

function createEmptyData(): BackupData {
  return {
    categories: [],
    credit_cards: [],
    card_competence_overrides: [],
    incomes: [],
    expenses: [],
    card_payments: [],
    debts: [],
    budgets: [],
    income_goals: [],
    insight_feedback: [],
    reminder_states: [],
    portfolio_assets: [],
    portfolio_transactions: [],
    portfolio_snapshots: [],
    portfolio_contributions: [],
    portfolio_dividends: [],
    allocation_targets: [],
    class_targets: [],
    sector_targets: [],
    asset_prices: [],
    cash_checkpoints: [],
    user_preferences: [],
  };
}

describe("RestoreWizardDialog (F22)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockMutateAsync.mockResolvedValue({ expenses: 1, categories: 1 });
    mockFetchAllUserData.mockResolvedValue(buildBackupPayload(createEmptyData()));
  });

  it("renderiza o modal fechado quando open=false", () => {
    render(<RestoreWizardDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Assistente de Restauração de Backup")).not.toBeInTheDocument();
  });

  it("renderiza a Etapa 1 (Validação) com Dropzone e Stepper quando aberto", () => {
    render(<RestoreWizardDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Assistente de Restauração de Backup")).toBeInTheDocument();
    expect(screen.getByText("Validação")).toBeInTheDocument();
    expect(screen.getByText("Módulos")).toBeInTheDocument();
    expect(screen.getByText("Desduplicação")).toBeInTheDocument();
    expect(screen.getByText("Confirmação")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /arraste o arquivo/i })).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "Avançar para Módulos" });
    expect(nextBtn).toBeDisabled();
  });

  it("rejeita arquivo com JSON corrompido ou inválido", async () => {
    render(<RestoreWizardDialog open={true} onOpenChange={vi.fn()} />);
    const badFile = new File(["{ quebrado"], "backup_corrompido.json", {
      type: "application/json",
    });

    const dropzone = screen.getByRole("button", { name: /arraste o arquivo/i });
    fireEvent.drop(dropzone, { dataTransfer: { files: [badFile] } });

    expect(await screen.findByText(/O arquivo selecionado não contém um formato JSON válido/i)).toBeInTheDocument();
  });

  it("avança por todas as 4 etapas com arquivo válido e executa restauração com sucesso", async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();
    render(
      <RestoreWizardDialog open={true} onOpenChange={vi.fn()} onSuccess={handleSuccess} />,
    );

    const data = createEmptyData();
    data.categories = [{ id: "cat-1", name: "Alimentação", type: "expense" }];
    data.expenses = [{ id: "exp-1", category_id: "cat-1", date: "2026-08-01", value: 50, description: "Padaria" }];
    const validPayload = buildBackupPayload(data);

    const validFile = new File([JSON.stringify(validPayload)], "meu_backup.json", {
      type: "application/json",
    });

    // ETAPA 1: Carrega arquivo
    const dropzone = screen.getByRole("button", { name: /arraste o arquivo/i });
    fireEvent.drop(dropzone, { dataTransfer: { files: [validFile] } });

    expect(await screen.findByText("meu_backup.json")).toBeInTheDocument();
    expect(screen.getByText("Válido")).toBeInTheDocument();
    expect(screen.getByText("Integridade & Checksum")).toBeInTheDocument();

    // Avança para ETAPA 2 (Módulos)
    const nextBtn1 = screen.getByRole("button", { name: "Avançar para Módulos" });
    expect(nextBtn1).not.toBeDisabled();
    await user.click(nextBtn1);

    expect(await screen.findByText("Selecione os módulos a restaurar")).toBeInTheDocument();
    expect(screen.getByText("Categorias & Preferências")).toBeInTheDocument();
    expect(screen.getByText("Transações Financeiras")).toBeInTheDocument();

    // Avança para ETAPA 3 (Desduplicação)
    const nextBtn2 = screen.getByRole("button", { name: /Avançar para Desduplicação/i });
    await user.click(nextBtn2);

    expect(await screen.findByText(/Identificação de duplicidades/i)).toBeInTheDocument();
    expect(screen.getByText("Pular duplicados")).toBeInTheDocument();
    expect(screen.getByText("Sobrescrever existentes")).toBeInTheDocument();
    expect(screen.getByText("Manter ambos")).toBeInTheDocument();
    expect(screen.getByText("Substituição completa")).toBeInTheDocument();

    // Seleciona a estratégia "Sobrescrever existentes"
    await user.click(screen.getByText("Sobrescrever existentes"));

    // Avança para ETAPA 4 (Confirmação)
    const nextBtn3 = screen.getByRole("button", { name: "Avançar para Confirmação" });
    await user.click(nextBtn3);

    expect(await screen.findByText("Revisão final antes de restaurar")).toBeInTheDocument();
    expect(screen.getByText("Sobrescrever duplicados existentes")).toBeInTheDocument();

    // Confirma Restauração
    const confirmBtn = screen.getByRole("button", { name: "Confirmar Restauração" });
    await user.click(confirmBtn);

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Restauração concluída com sucesso!")).toBeInTheDocument();

    // Clica em Concluir
    const doneBtn = screen.getByRole("button", { name: "Concluir" });
    await user.click(doneBtn);
    expect(handleSuccess).toHaveBeenCalledTimes(1);
  });
});
