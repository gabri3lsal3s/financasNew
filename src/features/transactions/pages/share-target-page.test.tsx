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
  createIncome: vi.fn(),
  deleteIncome: vi.fn(),
}));

describe("ShareTargetPage — Web Share Target & Auto-Cadastro (§1.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingSuggestions();
    dismissAutoRegisteredBanner();

    vi.spyOn(categoriesModule, "listCategories").mockResolvedValue([
      {
        id: "cat_mercado",
        name: "Alimentação",
        type: "expense",
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
});
