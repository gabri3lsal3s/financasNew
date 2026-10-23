import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssistantMemorySection } from "./assistant-memory-section";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";

vi.mock("@/features/overview/hooks", () => ({
  useSmartAdvisorDismissals: () => ({
    dismissals: {},
    revokeDismissal: vi.fn(),
    resetAll: vi.fn(),
  }),
}));

const mockOccurrences: RecurrenceOccurrence[] = [
  {
    key: "sub:netflix",
    name: "Netflix",
    level: "subscription",
    segment: "streaming",
    months: ["2026-06", "2026-07", "2026-08"],
    averageCents: 5590,
    confidence: 0.99,
  },
  {
    key: "recurring:academia",
    name: "Academia Smart Fit",
    level: "recurring",
    segment: "fitness",
    months: ["2026-06", "2026-07", "2026-08"],
    averageCents: 11990,
    confidence: 0.9,
  },
];

describe("AssistantMemorySection (F30)", () => {
  it("renderiza cabeçalho colapsado com contagem total de itens memorizados", () => {
    const futureExpiry = Date.now() + 10 * 24 * 60 * 60 * 1000;

    render(
      <AssistantMemorySection
        feedbackMap={{ "sub:netflix": "already_cancelled" }}
        onRevokeFeedback={vi.fn()}
        activeOccurrences={mockOccurrences}
        dismissals={{ "dup:spotify": futureExpiry }}
        onRevokeDismissal={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Memória de Aprendizado do Assistente \(2\)/i }),
    ).toBeInTheDocument();
  });

  it("expande a seção e lista descartes temporários (cooldowns) com data limite", async () => {
    const user = userEvent.setup();
    const expiry = new Date(2026, 10, 22, 12, 0, 0).getTime();

    render(
      <AssistantMemorySection
        feedbackMap={{}}
        onRevokeFeedback={vi.fn()}
        activeOccurrences={mockOccurrences}
        dismissals={{ "dup:spotify": expiry }}
        onRevokeDismissal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Memória de Aprendizado do Assistente/i }));

    expect(screen.getByText("Descartes Temporários sob Cooldown")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Descartado temporariamente até 22/11")).toBeInTheDocument();
    expect(screen.getByText("(Cobrança duplicada)")).toBeInTheDocument();
  });

  it("lista decisões de micro-feedback registradas com seus badges", async () => {
    const user = userEvent.setup();

    render(
      <AssistantMemorySection
        feedbackMap={{
          "sub:netflix": "already_cancelled",
          "recurring:academia": "one_off",
        }}
        onRevokeFeedback={vi.fn()}
        activeOccurrences={mockOccurrences}
        dismissals={{}}
        onRevokeDismissal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Memória de Aprendizado do Assistente/i }));

    expect(screen.getByText("Decisões de Micro-Feedback Registradas")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Já cancelei")).toBeInTheDocument();

    expect(screen.getByText("Academia Smart Fit")).toBeInTheDocument();
    expect(screen.getByText("É pontual")).toBeInTheDocument();
  });

  it("dispara callback ao clicar em Reativar monitoramento para um cooldown", async () => {
    const user = userEvent.setup();
    const mockRevokeDismissal = vi.fn();
    const futureExpiry = Date.now() + 10 * 24 * 60 * 60 * 1000;

    render(
      <AssistantMemorySection
        feedbackMap={{}}
        onRevokeFeedback={vi.fn()}
        activeOccurrences={mockOccurrences}
        dismissals={{ "dup:spotify": futureExpiry }}
        onRevokeDismissal={mockRevokeDismissal}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Memória de Aprendizado do Assistente/i }));

    const reactivateBtn = screen.getByRole("button", { name: /Reativar monitoramento de Spotify/i });
    await user.click(reactivateBtn);

    expect(mockRevokeDismissal).toHaveBeenCalledWith("dup:spotify");
  });

  it("dispara callback ao clicar em Reativar monitoramento para uma decisão de micro-feedback", async () => {
    const user = userEvent.setup();
    const mockRevokeFeedback = vi.fn();

    render(
      <AssistantMemorySection
        feedbackMap={{ "sub:netflix": "already_cancelled" }}
        onRevokeFeedback={mockRevokeFeedback}
        activeOccurrences={mockOccurrences}
        dismissals={{}}
        onRevokeDismissal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Memória de Aprendizado do Assistente/i }));

    const reactivateBtn = screen.getByRole("button", { name: /Reativar monitoramento de Netflix/i });
    await user.click(reactivateBtn);

    expect(mockRevokeFeedback).toHaveBeenCalledWith("sub:netflix");
  });

  it("renderiza item marcado como essencial e permite reativar monitoramento", async () => {
    const user = userEvent.setup();
    const mockRevokeFeedback = vi.fn();

    render(
      <AssistantMemorySection
        feedbackMap={{ "sub:google_ai": "essential" }}
        onRevokeFeedback={mockRevokeFeedback}
        activeOccurrences={[
          {
            key: "sub:google_ai",
            name: "Google AI Pro",
            level: "subscription",
            segment: "cloud_ai",
            months: ["2026-06", "2026-07", "2026-08"],
            averageCents: 9700,
            confidence: 0.99,
          },
        ]}
        dismissals={{}}
        onRevokeDismissal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Memória de Aprendizado do Assistente/i }));

    expect(screen.getByText("Google AI Pro")).toBeInTheDocument();
    expect(screen.getByText("Considerado essencial")).toBeInTheDocument();

    const reactivateBtn = screen.getByRole("button", { name: /Reativar monitoramento de Google AI Pro/i });
    await user.click(reactivateBtn);

    expect(mockRevokeFeedback).toHaveBeenCalledWith("sub:google_ai");
  });
});
