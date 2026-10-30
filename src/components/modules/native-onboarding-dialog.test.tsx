import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeOnboardingDialog } from "./native-onboarding-dialog";
import * as platformModule from "@/services/native/platform";
import {
  getDemoSessionState,
  hasSeenNativeOnboarding,
  markNativeOnboardingSeen,
  resetDemoSession,
  resetDemoTourStorage,
} from "@/state/demo-mode";

describe("NativeOnboardingDialog — Onboarding do App Nativo Android (§3.5)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();
  });

  it("renderiza automaticamente quando estiver em plataforma nativa e o usuário ainda não tiver visto", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    render(<NativeOnboardingDialog />);

    expect(screen.getByText("Bem-vindo ao App Nativo Android")).toBeInTheDocument();
    expect(
      screen.getByText(/Seu aplicativo foi instalado com sucesso/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Desempenho Acelerado")).toBeInTheDocument();
    expect(screen.getByText("Leitor de Notificações Bancárias")).toBeInTheDocument();
    expect(screen.getByText("Biometria & Escudo de Privacidade")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Fazer Tour Rápido \(1 min\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Depois" })).toBeInTheDocument();
  });

  it("não renderiza em ambiente web tradicional (isNativePlatform === false)", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    render(<NativeOnboardingDialog />);

    expect(screen.queryByText("Bem-vindo ao App Nativo Android")).not.toBeInTheDocument();
  });

  it("não renderiza se o onboarding já tiver sido visto anteriormente", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    markNativeOnboardingSeen();

    render(<NativeOnboardingDialog />);

    expect(screen.queryByText("Bem-vindo ao App Nativo Android")).not.toBeInTheDocument();
  });

  it("ao clicar em 'Depois', marca como visto no storage e fecha o diálogo", async () => {
    const user = userEvent.setup();
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const handleOpenChange = vi.fn();

    render(<NativeOnboardingDialog onOpenChange={handleOpenChange} />);

    const depoisBtn = screen.getByRole("button", { name: "Depois" });
    await user.click(depoisBtn);

    expect(hasSeenNativeOnboarding()).toBe(true);
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(false);
  });

  it("ao clicar em 'Fazer Tour Rápido', marca como visto, fecha o modal e inicia o tour app_native_apk", async () => {
    const user = userEvent.setup();
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const handleOpenChange = vi.fn();
    const handleStartTour = vi.fn();

    render(
      <NativeOnboardingDialog
        onOpenChange={handleOpenChange}
        onStartNativeTour={handleStartTour}
      />,
    );

    const tourBtn = screen.getByRole("button", {
      name: /Fazer Tour Rápido \(1 min\)/i,
    });
    await user.click(tourBtn);

    expect(hasSeenNativeOnboarding()).toBe(true);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleStartTour).toHaveBeenCalledTimes(1);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(true);
    expect(session.activeTrack).toBe("app_native_apk");
    expect(session.currentStepIndex).toBe(0);
  });

  it("não apresenta violações de acessibilidade (axe)", async () => {
    const { container } = render(<NativeOnboardingDialog forceShow={true} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
