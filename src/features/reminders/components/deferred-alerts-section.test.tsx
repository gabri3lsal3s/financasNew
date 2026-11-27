import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActiveCarouselDismissalEntry } from "@/domain/notifications/hub";
import { DeferredAlertsSection } from "./deferred-alerts-section";

describe("DeferredAlertsSection", () => {
  it("exibe estado vazio calmo quando não há avisos adiados", () => {
    render(<DeferredAlertsSection entries={[]} onReactivate={vi.fn()} />);

    expect(screen.getByText("Nenhum aviso adiado")).toBeInTheDocument();
    expect(
      screen.getByText(/Avisos dispensados nos carrosséis da Visão Geral/i),
    ).toBeInTheDocument();
  });

  it("lista avisos adiados com rótulo genérico, badge de módulo, data de retorno e botão acessível Reativar", async () => {
    const user = userEvent.setup();
    const onReactivate = vi.fn();
    const entries: ActiveCarouselDismissalEntry[] = [
      {
        canonicalId: "cashflow.pace",
        displayName: "Ritmo de gastos",
        module: "Visão Geral",
        dismissedUntil: new Date(2026, 11, 4, 0, 0).getTime(),
        returnDateLabel: "04/12",
        source: "canonical",
      },
      {
        canonicalId: "device.permissions.push_due",
        displayName: "Permissão de notificações",
        module: "Dispositivo",
        dismissedUntil: Number.POSITIVE_INFINITY,
        returnDateLabel: "Até reativar",
        source: "legacy",
      },
    ];

    render(<DeferredAlertsSection entries={entries} onReactivate={onReactivate} />);

    expect(screen.getByRole("region", { name: "Avisos adiados nos carrosséis" })).toBeInTheDocument();
    expect(screen.getByText("Ritmo de gastos")).toBeInTheDocument();
    expect(screen.getByText("Retorna em 04/12")).toBeInTheDocument();
    expect(screen.getByText("Permissão de notificações")).toBeInTheDocument();
    expect(screen.getByText("Oculto até reativar")).toBeInTheDocument();

    const reactivatePace = screen.getByRole("button", { name: "Reativar Ritmo de gastos" });
    await user.click(reactivatePace);
    expect(onReactivate).toHaveBeenCalledWith("cashflow.pace");
  });
});
