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
      screen.getByRole("button", { name: /Memória do Copiloto \(2\)/i }),
    ).toBeInTheDocument();
  });

  it("expande a seção e lista descartes temporários (cooldowns) com data limite", async () => {
    const user = userEvent.setup();
    const futureYear = new Date().getFullYear() + 1;
    const expiry = new Date(futureYear, 10, 22, 12, 0, 0).getTime();

    render(
      <AssistantMemorySection
        feedbackMap={{}}
        onRevokeFeedback={vi.fn()}
        activeOccurrences={mockOccurrences}
        dismissals={{ "dup:spotify": expiry }}
        onRevokeDismissal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Memória do Copiloto/i }));

    expect(screen.getByText("Temas em Cooldown & Famílias Pausadas")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /Memória do Copiloto/i }));

    expect(screen.getByText("Decisões de Aprendizado")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /Memória do Copiloto/i }));

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

    await user.click(screen.getByRole("button", { name: /Memória do Copiloto/i }));

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

    await user.click(screen.getByRole("button", { name: /Memória do Copiloto/i }));

    expect(screen.getByText("Google AI Pro")).toBeInTheDocument();
    expect(screen.getByText("Considerado essencial")).toBeInTheDocument();

    const reactivateBtn = screen.getByRole("button", { name: /Reativar monitoramento de Google AI Pro/i });
    await user.click(reactivateBtn);

    expect(mockRevokeFeedback).toHaveBeenCalledWith("sub:google_ai");
  });

  it("abre ConfirmDialog ao clicar em Reativar tudo e limpa cooldowns e feedbacks ao confirmar", async () => {
    const user = userEvent.setup();
    const mockRevokeFeedback = vi.fn();
    const mockRevokeDismissal = vi.fn();
    const futureExpiry = Date.now() + 10 * 24 * 60 * 60 * 1000;

    render(
      <AssistantMemorySection
        feedbackMap={{ "sub:netflix": "already_cancelled" }}
        onRevokeFeedback={mockRevokeFeedback}
        activeOccurrences={mockOccurrences}
        dismissals={{ "dup:spotify": futureExpiry }}
        onRevokeDismissal={mockRevokeDismissal}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Memória do Copiloto/i }));
    await user.click(screen.getByRole("button", { name: /Reativar tudo/i }));

    expect(screen.getByText("Reativar todo o monitoramento?")).toBeInTheDocument();

    const confirmBtns = screen.getAllByRole("button", { name: /Reativar tudo/i });
    await user.click(confirmBtns[confirmBtns.length - 1]!);

    expect(mockRevokeDismissal).toHaveBeenCalledWith("dup:spotify");
    expect(mockRevokeFeedback).toHaveBeenCalledWith("sub:netflix");
  });

  it("exibe Perfil de Renda Aprendido, Famílias Pausadas e Estabelecimentos Aprendidos com reversão em 1 clique (Fase 6)", async () => {
    const user = userEvent.setup();
    const onUnmuteFamily = vi.fn();
    const onForgetMerchant = vi.fn();

    render(
      <AssistantMemorySection
        feedbackMap={{}}
        onRevokeFeedback={vi.fn()}
        paydayProfile={{
          pattern: "start_of_month",
          typicalIncomeDays: [5],
          expectedMonthlyIncomeCents: 600_000,
          confidence: 0.9,
          monthsAnalyzed: 3,
        }}
        decayByFamily={{
          habit: {
            dismissCount: 3,
            lastDismissedAt: "2026-11-01T12:00:00Z",
            dismissedUntil: Date.now() + 80 * 86_400_000,
            muted: true,
          },
        }}
        onUnmuteFamily={onUnmuteFamily}
        merchantLearning={{
          "ifood*rest": { alias: "iFood", categoryName: "Alimentação", count: 5 },
        }}
        onForgetMerchant={onForgetMerchant}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Memória do Copiloto/i }));

    expect(screen.getByText(/Início do mês/i)).toBeInTheDocument();
    expect(screen.getByText(/Hábitos & Microgastos/i)).toBeInTheDocument();
    expect(screen.getByText("iFood")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reativar" }));
    expect(onUnmuteFamily).toHaveBeenCalledWith("habit");

    await user.click(screen.getByRole("button", { name: "Esquecer" }));
    expect(onForgetMerchant).toHaveBeenCalledWith("ifood*rest");
  });
});
