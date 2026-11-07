import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickShortcutsCard } from "./quick-shortcuts-card";
import * as stateModule from "@/state";

describe("QuickShortcutsCard", () => {
  it("renderiza lista de atalhos e permite gerar novo token", async () => {
    const mockTokens = [
      {
        id: "tok-1",
        token_prefix: "axq_12345678…",
        name: "Atalho iPhone",
        scopes: ["expense:write"],
        last_used_at: "2026-11-06T12:00:00Z",
        created_at: "2026-11-01T10:00:00Z",
      },
    ];

    vi.spyOn(stateModule, "useQuickTokens").mockReturnValue({
      data: mockTokens,
      isLoading: false,
    } as unknown as ReturnType<typeof stateModule.useQuickTokens>);

    const mutateAsyncMock = vi.fn().mockResolvedValue({});
    vi.spyOn(stateModule, "useCreateQuickToken").mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useCreateQuickToken>);

    vi.spyOn(stateModule, "useRevokeQuickToken").mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useRevokeQuickToken>);

    render(<QuickShortcutsCard />);

    expect(screen.getByText("Entrada Rápida iOS & Webhooks")).toBeInTheDocument();
    expect(screen.getByText("Atalho iPhone")).toBeInTheDocument();
    expect(screen.getByText("axq_12345678…")).toBeInTheDocument();

    const generateBtn = screen.getByRole("button", { name: /Gerar Atalho/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Atalho iPhone",
          scopes: ["expense:write"],
        }),
      );
    });
  });
});
