import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPixClipboardCard } from "./dashboard-pix-clipboard-card";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("DashboardPixClipboardCard", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o card no padrão do carrossel da Home", () => {
    render(<DashboardPixClipboardCard onLaunch={vi.fn()} />);

    expect(screen.getByText("Lançamento Rápido via Pix")).toBeInTheDocument();
    expect(screen.getByText("Colar Pix")).toBeInTheDocument();
  });

  it("ao clicar em 'Colar Pix', lê a área de transferência e dispara onLaunch com dados estruturados", async () => {
    const onLaunch = vi.fn();
    const user = userEvent.setup();

    Object.defineProperty(navigator, "clipboard", {
      value: {
        readText: vi.fn().mockResolvedValue("Pix de R$ 45,00 para Padaria São Bento"),
        writeText: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    render(<DashboardPixClipboardCard onLaunch={onLaunch} />);

    const button = screen.getByRole("button", { name: "Colar Pix" });
    await user.click(button);

    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        valorCents: 4500,
        forma: "pix",
      }),
    );

    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it("permite dispensar o card via callback onDismiss", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(<DashboardPixClipboardCard onLaunch={vi.fn()} onDismiss={onDismiss} />);

    const dismissBtn = screen.getByRole("button", { name: "Dispensar sugestão de Pix" });
    await user.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
