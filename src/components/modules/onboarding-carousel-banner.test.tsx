import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { OnboardingCounts } from "@/domain/onboarding";
import { OnboardingCarouselBanner } from "./onboarding-carousel-banner";

const partialCounts: OnboardingCounts = {
  expenseCategories: 11,
  incomeCategories: 3,
  cashCheckpoints: 1,
  cards: 0,
  transactions: 0,
  notificationsEnabled: false,
};

describe("OnboardingCarouselBanner — Fase 2 no Carrossel da Home", () => {
  it("exibe progresso correto e próximo passo sugerido", () => {
    render(
      <OnboardingCarouselBanner
        counts={partialCounts}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Primeiros passos no Axir")).toBeInTheDocument();
    expect(screen.getByText("1/3 concluídos")).toBeInTheDocument();
    expect(screen.getByText(/Próximo passo: Registrar primeiro lançamento/i)).toBeInTheDocument();
  });

  it("chama onContinue ao clicar em Continuar e onDismiss ao clicar em Dispensar", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const onDismiss = vi.fn();

    render(
      <OnboardingCarouselBanner
        counts={partialCounts}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Dispensar guia de primeiros passos/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("respeita acessibilidade básica sem violações axe", async () => {
    const { container } = render(
      <OnboardingCarouselBanner
        counts={partialCounts}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
