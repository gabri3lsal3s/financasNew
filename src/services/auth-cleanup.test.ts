import { describe, it, expect, vi, beforeEach } from "vitest";
import { purgeAccountState, purgeAccountStorage, resetAppState } from "./auth-cleanup";
import { QueryClient } from "@tanstack/react-query";
import { setPrivacyMasked, getPrivacyMasked } from "@/hooks/use-privacy-mask";
import { updateVisualCustomization, getVisualCustomization } from "@/hooks/use-visual-customization";
import {
  getActiveUserId,
  getUserStorageItem,
  setActiveUserId,
  setUserStorageItem,
} from "@/services/user-storage";
import { getCachedIconTier, setCachedIconTier } from "@/services/native/app-icon";
import {
  clearRecentReceipts,
  getRecentReceipts,
  registerReceiptDeduplication,
} from "@/services/native/suggestions-store";
import { getSupabase } from "@/data/client";
import {
  captureContext,
  isContextCurrent,
  resetSessionContextForTests,
  setSessionContext,
} from "@/services/session-context";
import {
  sanitizeTelemetryBreadcrumb,
  sanitizeTelemetryEvent,
  scrubSensitiveData,
} from "@/services/observability";

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
    resetSessionContextForTests();
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

    updateVisualCustomization({ accent: "gold", surfaceStyle: "flat", motionLevel: "reduced" });
    expect(document.documentElement.getAttribute("data-accent")).toBe("gold");
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
    setUserStorageItem("accent_theme", "mono", "user-b");

    // Estado ativo inicial: Usuário A
    updateVisualCustomization({ accent: "gold" }, "user-a");
    expect(getVisualCustomization().accent).toBe("gold");

    // Transiciona diretamente para Usuário B
    resetAppState(undefined, "user-b");

    expect(mockRemoveAllChannels).toHaveBeenCalledTimes(1);
    expect(getRecentReceipts()).toHaveLength(0);
    expect(window.sessionStorage.getItem("user_a_transient")).toBeNull();
    expect(getActiveUserId()).toBe("user-b");
    expect(getVisualCustomization().accent).toBe("mono");
    expect(document.documentElement.getAttribute("data-accent")).toBe("mono");
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

  it("expurga seletivamente o storage da conta A preservando integralmente os dados e preferências da conta B", () => {
    setActiveUserId("account-b");
    setUserStorageItem("theme", "dark", "account-a");
    setUserStorageItem("accent_theme", "gold", "account-a");
    setUserStorageItem("dashboard_widgets", "[1,2]", "account-a");

    setUserStorageItem("theme", "light", "account-b");
    setUserStorageItem("accent_theme", "mono", "account-b");
    setUserStorageItem("dashboard_widgets", "[3,4]", "account-b");
    window.sessionStorage.setItem("active_b_draft", "keep-me");

    const removed = purgeAccountState("account-a");

    expect(removed).toBe(3);
    expect(getUserStorageItem("theme", "account-a")).toBeNull();
    expect(getUserStorageItem("accent_theme", "account-a")).toBeNull();
    expect(getUserStorageItem("dashboard_widgets", "account-a")).toBeNull();

    // Conta B continua ativa e com todas as preferências preservadas
    expect(getActiveUserId()).toBe("account-b");
    expect(getUserStorageItem("theme", "account-b")).toBe("light");
    expect(getUserStorageItem("accent_theme", "account-b")).toBe("mono");
    expect(getUserStorageItem("dashboard_widgets", "account-b")).toBe("[3,4]");
    expect(window.sessionStorage.getItem("active_b_draft")).toBe("keep-me");
  });

  it("expurga conta A ativa durante transição para conta B e invalida contexto de sessão em voo", () => {
    setActiveUserId("account-a");
    setUserStorageItem("accent_theme", "gold", "account-a");
    setUserStorageItem("accent_theme", "mono", "account-b");

    setSessionContext({
      status: "authenticated",
      contextId: "ctx-a",
      csrfToken: "csrf-a",
      generation: 1,
      revision: 1,
      environment: "production",
      mode: "personal",
      accountRef: "account-a",
      displayName: "Conta A",
      expiresAt: Date.now() + 60_000,
    });
    const capturedA = captureContext();

    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, "clear");

    resetAppState(queryClient, "account-b", { purgeAccountKey: "account-a" });

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(isContextCurrent(capturedA)).toBe(false);
    expect(getUserStorageItem("accent_theme", "account-a")).toBeNull();
    expect(getActiveUserId()).toBe("account-b");
    expect(getUserStorageItem("accent_theme", "account-b")).toBe("mono");
  });

  it("ignora chaves reservadas (guest/active/vazio) em purgeAccountStorage", () => {
    window.localStorage.setItem("financas_guest_theme", "dark");
    window.localStorage.setItem("financas_active_theme", "dark");

    expect(purgeAccountStorage("")).toBe(0);
    expect(purgeAccountStorage("guest")).toBe(0);
    expect(purgeAccountStorage("active")).toBe(0);
    expect(window.localStorage.getItem("financas_guest_theme")).toBe("dark");
    expect(window.localStorage.getItem("financas_active_theme")).toBe("dark");
  });

  it("endurecimento S09: remove chaves de token/sessão/csrf/contextId/email de eventos e breadcrumbs", () => {
    const fakeJwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature1234567890";

    const sanitizedBreadcrumb = sanitizeTelemetryBreadcrumb({
      category: "fetch",
      message: `Sessão para joao@empresa.com com jwt ${fakeJwt}`,
      data: {
        url: "/api/sessions/v1/switch?csrfToken=csrf123&contextId=ctx999",
        csrfToken: "secret-csrf",
        "x-axir-csrf": "header-csrf",
        contextId: "ctx-999",
        "x-axir-context": "header-ctx",
        session: { id: "sess-1" },
        sessionId: "sess-1",
        accessToken: "acc-tok",
        refresh_token: "ref-tok",
        userEmail: "joao@empresa.com",
        statusCode: 200,
      },
    });

    expect(sanitizedBreadcrumb.message).toBe(
      "Sessão para [REDACTED_EMAIL] com jwt [REDACTED_TOKEN]",
    );
    expect(sanitizedBreadcrumb.data).toEqual({
      url: "/api/sessions/v1/switch?csrfToken=[REDACTED]&contextId=[REDACTED]",
      statusCode: 200,
    });

    const sanitizedEvent = sanitizeTelemetryEvent({
      message: "Erro de sessão para maria@exemplo.com",
      user: {
        id: "opaque-user-id",
        email: "maria@exemplo.com",
        sessionId: "sess-2",
      },
      extra: {
        contextId: "ctx-abc",
        csrf: "csrf-abc",
        session: "raw-session",
        access_token: "tok-123",
        safeMetric: "ok",
      },
      breadcrumbs: [sanitizedBreadcrumb],
      request: {
        url: "https://app.axir.com.br/api/data/v1/overview?sessionId=s1&email=maria@exemplo.com",
        headers: {
          "x-axir-context": "ctx-abc",
          "x-axir-csrf": "csrf-abc",
          "content-type": "application/json",
        },
      },
    });

    expect(sanitizedEvent.message).toBe("Erro de sessão para [REDACTED_EMAIL]");
    expect(sanitizedEvent.user).toEqual({ id: "opaque-user-id" });
    expect(sanitizedEvent.extra).toEqual({ safeMetric: "ok" });
    expect(sanitizedEvent.request?.url).toBe(
      "https://app.axir.com.br/api/data/v1/overview?sessionId=[REDACTED]&email=[REDACTED]",
    );
    expect(sanitizedEvent.request?.headers).toEqual({
      "content-type": "application/json",
    });

    // Verifica também scrubSensitiveData direto
    expect(
      scrubSensitiveData({
        csrf_token: "x",
        context_id: "y",
        session_id: "z",
        maskedEmail: "jo***@empresa.com",
        keep: "visible",
      }),
    ).toEqual({ keep: "visible" });
  });
});
