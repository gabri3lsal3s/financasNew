import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPixClipboardCard } from "./dashboard-pix-clipboard-card";
import type { DetectedPixTransaction } from "@/hooks";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("DashboardPixClipboardCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDetected: DetectedPixTransaction = {
    candidate: {
      kind: "pix_message",
      valueCents: 4500,
      description: "Padaria São Bento",
      recipientName: "Padaria São Bento",
      pixKey: "12345678000199",
      nature: "expense",
      paymentMethod: "pix",
      confidence: "high",
    },
    identity: {
      friendlyName: "Padaria São Bento",
      categorySlug: "alimentacao",
      isLearned: true,
      confidence: "canonical_catalog",
      layer: 3,
    },
    rawText: "Pix de R$ 45,00 para Padaria São Bento",
  };

  it("renderiza o card no padrão do carrossel da Home com dados detectados", () => {
    render(
      <DashboardPixClipboardCard
        detected={mockDetected}
        onLaunch={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Padaria São Bento")).toBeInTheDocument();
    expect(screen.getByText("PIX DETECTADO")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*45,00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lançar Despesa/i })).toBeInTheDocument();
  });

  it("ao clicar em Lançar Despesa, dispara onLaunch com dados estruturados e enriquecidos pela memória", async () => {
    const onLaunch = vi.fn();
    const user = userEvent.setup();

    render(
      <DashboardPixClipboardCard
        detected={mockDetected}
        onLaunch={onLaunch}
        onDismiss={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: /Lançar Despesa/i });
    await user.click(button);

    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(onLaunch).toHaveBeenCalledWith({
      valorCents: 4500,
      desc: "Padaria São Bento",
      categoria: "alimentacao",
      tipo: "expense",
      forma: "pix",
      pixKey: "12345678000199",
    });
  });

  it("renderiza botão de Lançar Receita quando nature for income", () => {
    const incomeDetected: DetectedPixTransaction = {
      ...mockDetected,
      candidate: {
        ...mockDetected.candidate,
        nature: "income",
      },
      identity: {
        ...mockDetected.identity,
        defaultNature: "income",
      },
    };

    render(
      <DashboardPixClipboardCard
        detected={incomeDetected}
        onLaunch={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Lançar Receita/i })).toBeInTheDocument();
  });

  it("permite dispensar o card via callback onDismiss", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(
      <DashboardPixClipboardCard
        detected={mockDetected}
        onLaunch={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    const dismissBtn = screen.getByRole("button", { name: "Dispensar sugestão de Pix" });
    await user.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
