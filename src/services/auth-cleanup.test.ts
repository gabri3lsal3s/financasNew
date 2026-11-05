import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetAppState } from "./auth-cleanup";
import { QueryClient } from "@tanstack/react-query";
import { setPrivacyMasked, getPrivacyMasked } from "@/hooks/use-privacy-mask";
import { updateVisualCustomization, getVisualCustomization } from "@/hooks/use-visual-customization";
import { getActiveUserId, setActiveUserId, setUserStorageItem } from "@/services/user-storage";
import { getCachedIconTier, setCachedIconTier } from "@/services/native/app-icon";
import {
  clearRecentReceipts,
  getRecentReceipts,
  registerReceiptDeduplication,
} from "@/services/native/suggestions-store";
import { getSupabase } from "@/data/client";

const mockRemoveAllChannels = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(() => ({
    removeAllChannels: mockRemoveAllChannels,
  })),
}));

describe("auth-cleanup", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearRecentReceipts();
    mockRemoveAllChannels.mockClear();
    vi.mocked(getSupabase).mockReturnValue({
      removeAllChannels: mockRemoveAllChannels,
    } as unknown as ReturnType<typeof getSupabase>);
    setActiveUserId("user-before");
    setPrivacyMasked(false);
  });

  it("reseta cache do queryClient, stores em memória e atributos do DOM", () => {
    const queryClient = new QueryClient();
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");
    const clearSpy = vi.spyOn(queryClient, "clear");

    // Modifica estados de UI
    setPrivacyMasked(true);
    expect(document.documentElement.dataset.privacy).toBe("masked");
    expect(getPrivacyMasked()).toBe(true);

    setCachedIconTier("PRO");
    expect(getCachedIconTier()).toBe("PRO");

    updateVisualCustomization({ accent: "rose", surfaceStyle: "flat", motionLevel: "reduced" });
    expect(document.documentElement.getAttribute("data-accent")).toBe("rose");
    expect(document.documentElement.getAttribute("data-surface-style")).toBe("flat");
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");

    // Executa reset completo (ex: logout com nextUserId = null)
    resetAppState(queryClient, null);

    // 1. TanStack Query cancelado e limpo
    expect(cancelSpy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();

    // 2. Active User resetado e tier de ícone revertido para FREE
    expect(getActiveUserId()).toBeNull();
    expect(getCachedIconTier()).toBe("FREE");

    // 3. Privacy Mask resetado
    expect(getPrivacyMasked()).toBe(false);
    expect(document.documentElement.dataset.privacy).toBeUndefined();

    // 4. Visual Customization resetado para padrões
    const visual = getVisualCustomization();
    expect(visual.accent).toBe("teal");
    expect(visual.surfaceStyle).toBe("glass");
    expect(visual.motionLevel).toBe("fluid");
    expect(document.documentElement.getAttribute("data-accent")).toBeNull();
    expect(document.documentElement.getAttribute("data-surface-style")).toBeNull();
    expect(document.documentElement.getAttribute("data-motion")).toBeNull();
  });

  it("desconecta canais realtime do Supabase, purga comprovantes bancários e limpa sessionStorage", () => {
    // 1. Preenche sessionStorage com dados transitórios de checkout/sessão
    window.sessionStorage.setItem("checkout_temp_token", "chk_test_123");
    window.sessionStorage.setItem("transient_nav_state", "tab_cards");
    expect(window.sessionStorage.getItem("checkout_temp_token")).toBe("chk_test_123");

    // 2. Preenche buffer em memória de comprovantes bancários
    registerReceiptDeduplication({
      id: "receipt_test_1",
      bankName: "Nubank",
      nature: "expense",
      type: "expense",
      amountCents: 9900,
      description: "Supermercado",
      merchant: "Supermercado",
      date: "2026-11-04",
      rawText: "Comprovante de pagamento Supermercado R$ 99,00",
      timestamp: Date.now(),
      source: "receipt",
    });
    expect(getRecentReceipts()).toHaveLength(1);

    // 3. Executa resetAppState
    resetAppState(undefined, null);

    // 4. Valida desconexão de canais Realtime
    expect(mockRemoveAllChannels).toHaveBeenCalledTimes(1);

    // 5. Valida purga dos comprovantes bancários em memória
    expect(getRecentReceipts()).toHaveLength(0);

    // 6. Valida limpeza integral do sessionStorage
    expect(window.sessionStorage.getItem("checkout_temp_token")).toBeNull();
    expect(window.sessionStorage.getItem("transient_nav_state")).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("ao transicionar para novo usuário, desconecta realtime, purga comprovantes e carrega configurações isoladas do novo usuário", () => {
    // Configura usuário A
    setActiveUserId("user-a");
    setUserStorageItem("accent_theme", "gold", "user-a");
    window.sessionStorage.setItem("user_a_transient", "value_a");
    registerReceiptDeduplication({
      id: "receipt_user_a",
      bankName: "Itaú",
      nature: "expense",
      type: "expense",
      amountCents: 4500,
      description: "Restaurante",
      date: "2026-11-04",
      rawText: "Comprovante de pagamento Restaurante R$ 45,00",
      timestamp: Date.now(),
      source: "receipt",
    });

    // Configura usuário B
    setUserStorageItem("accent_theme", "violet", "user-b");

    // Estado ativo inicial: Usuário A
    updateVisualCustomization({ accent: "gold" }, "user-a");
    expect(getVisualCustomization().accent).toBe("gold");

    // Transiciona diretamente para Usuário B
    resetAppState(undefined, "user-b");

    expect(mockRemoveAllChannels).toHaveBeenCalledTimes(1);
    expect(getRecentReceipts()).toHaveLength(0);
    expect(window.sessionStorage.getItem("user_a_transient")).toBeNull();
    expect(getActiveUserId()).toBe("user-b");
    expect(getVisualCustomization().accent).toBe("violet");
    expect(document.documentElement.getAttribute("data-accent")).toBe("violet");
  });

  it("trata defensivamente falhas de desconexão realtime e sessionStorage sem interromper o fluxo", () => {
    // Simula erro no cliente Supabase ao tentar desconectar canais
    vi.mocked(getSupabase).mockImplementationOnce(() => {
      throw new Error("Supabase client indisponível");
    });

    // Simula falha ao tentar limpar sessionStorage
    const clearSpy = vi.spyOn(window.sessionStorage, "clear").mockImplementationOnce(() => {
      throw new Error("SecurityError: Access is denied");
    });

    expect(() => {
      resetAppState(undefined, null);
    }).not.toThrow();

    expect(getActiveUserId()).toBeNull();
    clearSpy.mockRestore();
  });
});
