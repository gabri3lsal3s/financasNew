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
    expect(screen.getByText("1/2 concluídos")).toBeInTheDocument();
    expect(screen.getByText(/Próximo passo: Registrar primeiro lançamento/i)).toBeInTheDocument();
  });

  it("chama onContinue ao clicar em Continuar, abre presets e dispara fallback onDismiss ou onSelectPreset", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const onDismiss = vi.fn();

    const { rerender } = render(
      <OnboardingCarouselBanner
        counts={partialCounts}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Dispensar guia de primeiros passos/i }));
    await user.click(screen.getByRole("button", { name: /Dispensar por 7 dias/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const onSelectPreset = vi.fn();
    rerender(
      <OnboardingCarouselBanner
        counts={partialCounts}
        onContinue={onContinue}
        onDismiss={onDismiss}
        onSelectPreset={onSelectPreset}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Dispensar guia de primeiros passos/i }));
    expect(screen.getByRole("button", { name: /Dispensar em 6 meses/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Dispensar em 1 mês/i }));
    expect(onSelectPreset).toHaveBeenCalledWith("1m");
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
