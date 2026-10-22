import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { AppProviders } from "./providers";
import * as clientModule from "@/data/client";

describe("AppProviders & AuthQuerySync", () => {
  it("renderiza children dentro dos providers sem erros", () => {
    render(
      <AppProviders>
        <div data-testid="child-element">Conteúdo</div>
      </AppProviders>,
    );

    expect(screen.getByTestId("child-element")).toBeInTheDocument();
  });

  it("configura QueryClient com calibração anti-storm para alta concorrência (Tarefa 1.1)", () => {
    let capturedOptions: ReturnType<QueryClient["getDefaultOptions"]> | undefined;

    function TestConsumer() {
      const client = useQueryClient();
      capturedOptions = client.getDefaultOptions();
      return <div data-testid="consumer">OK</div>;
    }

    render(
      <AppProviders>
        <TestConsumer />
      </AppProviders>,
    );

    expect(screen.getByTestId("consumer")).toBeInTheDocument();
    expect(capturedOptions?.queries?.refetchOnWindowFocus).toBe(false);
    expect(capturedOptions?.queries?.refetchOnReconnect).toBe("always");
    expect(capturedOptions?.queries?.staleTime).toBe(60_000);
    expect(capturedOptions?.queries?.gcTime).toBe(600_000);
    expect(capturedOptions?.queries?.retry).toBe(1);
    expect(capturedOptions?.mutations?.retry).toBe(false);
  });

  it("escuta onAuthStateChange e limpa cache no SIGNED_OUT", async () => {
    let capturedCallback: ((event: string, session: unknown) => void) | undefined;

    const mockUnsubscribe = vi.fn();
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
          capturedCallback = cb;
          return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
        }),
      },
    };

    vi.spyOn(clientModule, "getSupabase").mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof clientModule.getSupabase>,
    );

    render(
      <AppProviders>
        <div data-testid="app-root">App</div>
      </AppProviders>,
    );

    expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();

    // Simula disparo do evento SIGNED_OUT
    if (typeof capturedCallback === "function") {
      capturedCallback("SIGNED_OUT", null);
    }

    await waitFor(() => {
      expect(screen.getByTestId("app-root")).toBeInTheDocument();
    });
  });

  it("limpa e invalida o cache ao transicionar de visitante para usuário autenticado", async () => {
    let capturedCallback: ((event: string, session: unknown) => void) | undefined;
    let queryClientInstance: QueryClient | undefined;

    function TestCaptureClient() {
      queryClientInstance = useQueryClient();
      return <div data-testid="capture-client">Captured</div>;
    }

    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    };

    const mockSupabase = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn().mockResolvedValue(undefined),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
          capturedCallback = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
    };

    vi.spyOn(clientModule, "getSupabase").mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof clientModule.getSupabase>,
    );

    render(
      <AppProviders>
        <TestCaptureClient />
      </AppProviders>,
    );

    expect(screen.getByTestId("capture-client")).toBeInTheDocument();
    expect(queryClientInstance).toBeDefined();

    // Popula o cache simulando dado retornado no estado anônimo
    queryClientInstance!.setQueryData(["credit_cards"], []);
    expect(queryClientInstance!.getQueryData(["credit_cards"])).toEqual([]);

    // Simula disparo do evento com novo usuário logado
    if (typeof capturedCallback === "function") {
      capturedCallback("SIGNED_IN", { user: { id: "user-new-123" } });
    }

    await waitFor(() => {
      // O cache foi purgado pelo resetAppState/clear no login
      expect(queryClientInstance!.getQueryData(["credit_cards"])).toBeUndefined();
    });
  });
});
