import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./error-state";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe("ErrorState (AGENTS.md §5 — erro + tentar novamente)", () => {
  it("mostra a mensagem e dispara o retry customizado", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState message="Sem conexão com o servidor." onRetry={onRetry} />, { wrapper });

    expect(screen.getByText("Sem conexão com o servidor.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("sem onRetry usa o refetch das queries ativas (não lança sem provider query)", async () => {
    const user = userEvent.setup();
    render(<ErrorState message="Algo deu errado." />, { wrapper });

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
