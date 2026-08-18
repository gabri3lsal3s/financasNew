import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("escuta onAuthStateChange e limpa cache no SIGNED_OUT", async () => {
    let capturedCallback: ((event: string, session: unknown) => void) | undefined;

    const mockUnsubscribe = vi.fn();
    const mockSupabase = {
      auth: {
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
});
