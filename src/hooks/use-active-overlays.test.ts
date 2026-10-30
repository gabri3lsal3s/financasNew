import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hasActiveDialogInDom,
  isLaunchWizardActive,
  useActiveOverlays,
} from "./use-active-overlays";
import { endDemo, resetDemoSession, startDemo } from "@/state/demo-mode";

describe("useActiveOverlays — Detecção Reativa de Overlays e Modais (§4.1)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    resetDemoSession();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    resetDemoSession();
    window.history.replaceState({}, "", "/");
  });

  it("retorna falso para todos os indicadores em estado inicial limpo", () => {
    const { result } = renderHook(() => useActiveOverlays());

    expect(result.current.hasBlockingOverlay).toBe(false);
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.isDemoActive).toBe(false);
    expect(result.current.isWizardOpen).toBe(false);
  });

  it("detecta abertura e fechamento reativo de modal com role='dialog' no DOM", async () => {
    const { result } = renderHook(() => useActiveOverlays());
    expect(result.current.hasBlockingOverlay).toBe(false);

    // Cria e anexa modal no DOM
    const modalEl = document.createElement("div");
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("data-state", "open");

    act(() => {
      document.body.appendChild(modalEl);
    });

    expect(hasActiveDialogInDom()).toBe(true);
    await waitFor(() => {
      expect(result.current.isDialogOpen).toBe(true);
      expect(result.current.hasBlockingOverlay).toBe(true);
    });

    // Fecha o modal via data-state='closed'
    act(() => {
      modalEl.setAttribute("data-state", "closed");
    });

    expect(hasActiveDialogInDom()).toBe(false);
    await waitFor(() => {
      expect(result.current.isDialogOpen).toBe(false);
      expect(result.current.hasBlockingOverlay).toBe(false);
    });

    // Remove do DOM
    act(() => {
      modalEl.removeAttribute("data-state");
      document.body.removeChild(modalEl);
    });

    await waitFor(() => {
      expect(result.current.isDialogOpen).toBe(false);
    });
  });

  it("ignora elementos com role='dialog' marcados com data-lock-overlay", () => {
    const lockEl = document.createElement("div");
    lockEl.setAttribute("role", "dialog");
    lockEl.setAttribute("data-lock-overlay", "true");

    act(() => {
      document.body.appendChild(lockEl);
    });

    const { result } = renderHook(() => useActiveOverlays());

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.hasBlockingOverlay).toBe(false);
  });

  it("detecta modais com role='alertdialog' ativos no DOM", async () => {
    const alertEl = document.createElement("div");
    alertEl.setAttribute("role", "alertdialog");

    act(() => {
      document.body.appendChild(alertEl);
    });

    const { result } = renderHook(() => useActiveOverlays());

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.hasBlockingOverlay).toBe(true);

    act(() => {
      alertEl.setAttribute("data-state", "closed");
    });

    expect(hasActiveDialogInDom()).toBe(false);
    await waitFor(() => {
      expect(result.current.isDialogOpen).toBe(false);
      expect(result.current.hasBlockingOverlay).toBe(false);
    });
  });

  it("detecta reativamente quando o tour de demonstração está ativo", () => {
    const { result } = renderHook(() => useActiveOverlays());
    expect(result.current.isDemoActive).toBe(false);
    expect(result.current.hasBlockingOverlay).toBe(false);

    act(() => {
      startDemo("finances");
    });

    expect(result.current.isDemoActive).toBe(true);
    expect(result.current.hasBlockingOverlay).toBe(true);

    act(() => {
      endDemo();
    });

    expect(result.current.isDemoActive).toBe(false);
    expect(result.current.hasBlockingOverlay).toBe(false);
  });

  it("detecta o LaunchWizard ativo quando parâmetros 'novo=' estão presentes na URL", () => {
    window.history.replaceState({}, "", "/?novo=transacao");

    expect(isLaunchWizardActive()).toBe(true);

    const { result } = renderHook(() => useActiveOverlays());

    expect(result.current.isWizardOpen).toBe(true);
    expect(result.current.hasBlockingOverlay).toBe(true);
  });

  it("detecta o LaunchWizard ativo quando elemento com data-tour='launch-wizard' é inserido no DOM", async () => {
    const { result } = renderHook(() => useActiveOverlays());
    expect(result.current.isWizardOpen).toBe(false);

    const wizardEl = document.createElement("div");
    wizardEl.setAttribute("data-tour", "launch-wizard");

    act(() => {
      document.body.appendChild(wizardEl);
    });

    expect(isLaunchWizardActive()).toBe(true);
    await waitFor(() => {
      expect(result.current.isWizardOpen).toBe(true);
      expect(result.current.hasBlockingOverlay).toBe(true);
    });

    act(() => {
      document.body.removeChild(wizardEl);
    });

    expect(isLaunchWizardActive()).toBe(false);
    await waitFor(() => {
      expect(result.current.isWizardOpen).toBe(false);
    });
  });

  it("detecta modais de primeiro uso (WelcomeFeatureModal / WelcomeModal)", () => {
    const welcomeEl = document.createElement("div");
    welcomeEl.setAttribute("role", "dialog");
    welcomeEl.setAttribute("aria-label", "A Mágica da Captura Sem Fricção");

    act(() => {
      document.body.appendChild(welcomeEl);
    });

    const { result } = renderHook(() => useActiveOverlays());

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.hasBlockingOverlay).toBe(true);
  });
});
