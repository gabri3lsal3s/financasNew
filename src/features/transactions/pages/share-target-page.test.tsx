import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPlugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn().mockResolvedValue({ granted: false }),
  requestPermission: vi.fn().mockResolvedValue({ granted: false }),
  flushPendingNotifications: vi.fn().mockResolvedValue({ notifications: [] }),
  getInstalledBankingApps: vi.fn().mockResolvedValue({ apps: [], installedBankNames: [] }),
  syncMonitoredPackages: vi.fn().mockResolvedValue({ success: true, count: 0 }),
  getPendingShare: vi.fn().mockResolvedValue({ text: null }),
  addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
}));

vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return {
    ...actual,
    registerPlugin: () => mockPlugin,
  };
});

import * as toastModule from "@/services/toast";
import * as sensoryModule from "@/services/sensory";
import * as rpcModule from "@/data/rpc";
import * as categoriesModule from "@/data/repositories/categories";
import * as creditCardsModule from "@/data/repositories/credit-cards";
import * as merchantLearningModule from "@/services/merchant-learning";
import {
  clearPendingSuggestions,
  dismissAutoRegisteredBanner,
  getAutoRegisteredBanner,
  getPendingSuggestions,
  revertAutoRegisteredTransaction,
} from "@/services/native";
import { ShareTargetPage } from "./share-target-page";

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/data/repositories/categories", () => ({
  listCategories: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  createExpenseWithDebt: vi.fn(),
  createIncomeInstallments: vi.fn(),
  deleteExpenseInstallments: vi.fn(),
}));

vi.mock("@/data/repositories/incomes", () => ({
  createIncome: vi.fn().mockResolvedValue({ id: "income-created-123" }),
  deleteIncome: vi.fn().mockResolvedValue({ id: "income-deleted-123" }),
}));

vi.mock("@/data/repositories/credit-cards", () => ({
  listCreditCards: vi.fn().mockResolvedValue([]),
}));

describe("ShareTargetPage — Web Share Target & Auto-Cadastro (§1.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingSuggestions();
    dismissAutoRegisteredBanner();

    vi.spyOn(categoriesModule, "listCategories").mockImplementation(async (type) => [
      {
        id: type === "income" ? "cat_salario" : "cat_mercado",
        name: type === "income" ? "Salário" : "Alimentação",
        type: type || "expense",
        icon: null,
        color: null,
        is_reserved: false,
        is_active: true,
        user_id: "user_test",
      },
    ]);

    vi.spyOn(rpcModule, "createExpenseWithDebt").mockResolvedValue("expense-created-123");
    vi.spyOn(rpcModule, "deleteExpenseInstallments").mockResolvedValue(1);
    mockPlugin.getPendingShare.mockResolvedValue({ text: "" });
  });

  it("redireciona para / quando não há parâmetros de compartilhamento nem buffer nativo", async () => {
    render(
      <MemoryRouter initialEntries={["/share-target"]}>
        <ShareTargetPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("efetiva o auto-cadastro imediato via RPC transacional, emite Toast com Desfazer e define banner persistente", async () => {
    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory").mockImplementation(() => {});

    render(
      <MemoryRouter
        initialEntries={[
          `/share-target?text=${encodeURIComponent(
            "Comprovante Pix Nubank: Valor R$ 120,50 Beneficiário: Mercado Central",
          )}`,
        ]}
      >
        <ShareTargetPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(rpcModule.createExpenseWithDebt).toHaveBeenCalledTimes(1);
    });

    expect(rpcModule.createExpenseWithDebt).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 120.5,
        paymentMethod: "pix",
        categoryId: "cat_mercado",
      }),
    );

    expect(sensorySpy).toHaveBeenCalledWith("success");

    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Pix de R\$\s*120,50 para Mercado Central cadastrado!/),
        variant: "success",
        duration: 5000,
        action: expect.objectContaining({
          label: "Desfazer (5s)",
        }),
      }),
    );

    const banner = getAutoRegisteredBanner();
    expect(banner).toBeDefined();
    expect(banner?.id).toBe("expense-created-123");
    expect(banner?.amountCents).toBe(12050);
    expect(banner?.merchant).toBe("Mercado Central");

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("ação de reversão (Desfazer): remove lançamento criado via RPC, restaura sugestão na fila e descarta banner", async () => {
    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);

    render(
      <MemoryRouter
        initialEntries={[
          `/share-target?text=${encodeURIComponent(
            "Comprovante Pix Nubank: Valor R$ 45,00 Beneficiário: Padaria Silva",
          )}`,
        ]}
      >
        <ShareTargetPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(rpcModule.createExpenseWithDebt).toHaveBeenCalledTimes(1);
    });

    const banner = getAutoRegisteredBanner();
    expect(banner).not.toBeNull();
    if (!banner) throw new Error("Banner não foi registrado");

    // Executa a reversão (Desfazer)
    const reverted = await revertAutoRegisteredTransaction(banner);
    expect(reverted).toBe(true);

    // Verifica que chamou o RPC de exclusão da parcela criada
    expect(rpcModule.deleteExpenseInstallments).toHaveBeenCalledWith("expense-created-123", "single");

    // O banner deve ter sido descartado
    expect(getAutoRegisteredBanner()).toBeNull();

    // A transação foi devolvida para a fila de sugestões para o usuário não perder os dados
    const suggestions = getPendingSuggestions();
    expect(suggestions.length).toBe(1);
    expect(suggestions[0]!.amountCents).toBe(4500);

    // Toast informativo de reversão foi emitido
    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Lançamento desfeito com sucesso",
        variant: "default",
      }),
    );
  });

  it("trata falha no RPC transacional: preserva comprovante na fila de sugestões e emite Toast de erro", async () => {
    vi.spyOn(rpcModule, "createExpenseWithDebt").mockRejectedValue(
      new Error("Falha temporária de rede no Supabase"),
    );

    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory").mockImplementation(() => {});

    render(
      <MemoryRouter
        initialEntries={[
          `/share-target?text=${encodeURIComponent(
            "Comprovante Pix Nubank: Valor R$ 85,00 Beneficiário: Farmácia Popular",
          )}`,
        ]}
      >
        <ShareTargetPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    expect(sensorySpy).toHaveBeenCalledWith("warning");
    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erro ao cadastrar comprovante",
        variant: "destructive",
      }),
    );

    // Comprovante foi retido na fila de sugestões para não haver perda de dados
    const suggestions = getPendingSuggestions();
    expect(suggestions.length).toBe(1);
    expect(suggestions[0]!.amountCents).toBe(8500);
    expect(getAutoRegisteredBanner()).toBeNull();
  });

  it("consome comprovante do buffer nativo do plugin (Cold Start) se query params estiverem vazios", async () => {
    mockPlugin.getPendingShare.mockResolvedValue({
      text: "Comprovante Pix Nubank: Valor R$ 60,00 Beneficiário: Posto Ipiranga",
    });

    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);

    render(
      <MemoryRouter initialEntries={["/share-target"]}>
        <ShareTargetPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(rpcModule.createExpenseWithDebt).toHaveBeenCalledTimes(1);
    });

    expect(rpcModule.createExpenseWithDebt).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 60,
      }),
    );

    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Pix de R\$\s*60,00 para Posto Ipiranga cadastrado!/),
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("quando o texto compartilhado não é reconhecido, emite Toast de aviso e não chama RPC", async () => {
    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/share-target?text=Texto%20aleatorio%20sem%20valor"]}>
        <ShareTargetPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    expect(rpcModule.createExpenseWithDebt).not.toHaveBeenCalled();
    expect(sensorySpy).toHaveBeenCalledWith("warning");
    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Comprovante não identificado",
        variant: "destructive",
      }),
    );
  });

  it("renderiza skeleton acessível de carregamento", () => {
    render(
      <MemoryRouter initialEntries={["/share-target"]}>
        <ShareTargetPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("region", { name: "Processamento de comprovante compartilhado" })).toBeInTheDocument();
    expect(screen.getByText("Processando comprovante compartilhado...")).toBeInTheDocument();
  });

  it("auto-cadastra comprovante de cartão parcelado com auto-resolução do cartão, closing_day e mensagem personalizada", async () => {
    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);
    vi.spyOn(sensoryModule, "triggerSensory").mockImplementation(() => {});
    const recordLearningSpy = vi.spyOn(merchantLearningModule, "recordTransactionLearning").mockImplementation(() => {});

    vi.spyOn(creditCardsModule, "listCreditCards").mockResolvedValue([
      {
        id: "card-itau-visa-1",
        name: "Itaú Click Visa",
        brand: "visa",
        closing_day: 10,
        due_day: 20,
        is_active: true,
        user_id: "user_test",
        credit_limit: 5000,
        color: null,
      },
    ]);

    const slipText = [
      "REDE",
      "PADARIA ESTRELA",
      "VIA DO CLIENTE",
      "DATA: 25/10/2026 14:30",
      "CREDITO PARCELADO",
      "PARC: 03",
      "VALOR DA PARCELA: R$ 50,00",
      "VALOR TOTAL: R$ 150,00",
      "CARTAO: VISA FINAL 4821",
      "AUT: 918273",
    ].join("\n");

    render(
      <MemoryRouter initialEntries={[`/share-target?text=${encodeURIComponent(slipText)}`]}>
        <ShareTargetPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(rpcModule.createExpenseWithDebt).toHaveBeenCalledTimes(1);
    });

    expect(rpcModule.createExpenseWithDebt).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 150,
        paymentMethod: "credit_card",
        cardId: "card-itau-visa-1",
        description: expect.stringMatching(/Padaria Estrela/i),
        installments: expect.arrayContaining([
          expect.objectContaining({
            value: 50,
            billCompetence: expect.any(String),
          }),
        ]),
      }),
    );

    // Verifica que o array de parcelas tem 3 itens
    const callArgs = vi.mocked(rpcModule.createExpenseWithDebt).mock.calls[0]?.[0];
    expect(callArgs?.installments).toHaveLength(3);

    // Toast personalizado: "Cartão de Crédito de R$ 150,00 (3x) para Padaria Estrela cadastrado!"
    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Cartão de Crédito de R\$\s*150,00\s*\(3x\)\s*para Padaria Estrela cadastrado!/),
        variant: "success",
      }),
    );

    // Banner persistente com o título discriminado
    const banner = getAutoRegisteredBanner();
    expect(banner).toBeDefined();
    expect(banner?.paymentMethod).toBe("credit_card");
    expect(banner?.cardId).toBe("card-itau-visa-1");
    expect(banner?.installments).toBe(3);
    expect(banner?.bannerTitle).toMatch(/Cartão de Crédito de R\$\s*150,00\s*\(3x\)\s*para Padaria Estrela cadastrado!/);

    // Aprendizado contínuo registrado
    expect(recordLearningSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant: expect.stringMatching(/Padaria Estrela/i),
        paymentMethod: "credit_card",
        cardId: "card-itau-visa-1",
        cardLastDigits: "4821",
      }),
    );
  });

  it("auto-cadastra comprovante de renda parcelada acionando buildIncomeInstallments e mensagem discriminada", async () => {
    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);
    vi.spyOn(rpcModule, "createIncomeInstallments").mockResolvedValue("income-installments-123");

    // Comprovante Pix com recebimento parcelado
    const incomeSlip = [
      "COMPROVANTE DE TRANSFERENCIA PIX",
      "PIX RECEBIDO",
      "ORIGEM: JOAO SILVA",
      "VALOR: R$ 600,00",
      "PARCELAS: 2X",
      "DATA: 25/10/2026",
    ].join("\n");

    render(
      <MemoryRouter initialEntries={[`/share-target?text=${encodeURIComponent(incomeSlip)}`]}>
        <ShareTargetPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(rpcModule.createIncomeInstallments).toHaveBeenCalledTimes(1);
    });

    expect(rpcModule.createIncomeInstallments).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 600,
        receiveType: "pix",
        installments: expect.arrayContaining([
          expect.objectContaining({
            value: 300,
          }),
        ]),
      }),
    );

    const callArgs = vi.mocked(rpcModule.createIncomeInstallments).mock.calls[0]?.[0];
    expect(callArgs?.installments).toHaveLength(2);

    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Pix de R\$\s*600,00 recebido de JOAO SILVA cadastrado!|Receita de R\$\s*600,00\s*\(2x\)\s*de JOAO SILVA cadastrada!/),
        variant: "success",
      }),
    );
  });
});
