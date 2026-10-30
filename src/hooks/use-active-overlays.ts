import { useEffect, useState } from "react";
import { useDemoSession } from "@/state/demo-mode";

export interface ActiveOverlaysResult {
  /**
   * Indica se há algum overlay bloqueante ou modal ativo na interface
   * (modais de diálogo, tour de demonstração interativo, wizard de lançamento ou onboarding).
   */
  hasBlockingOverlay: boolean;
  /** Indica se há um modal de diálogo ou alerta ativo no DOM. */
  isDialogOpen: boolean;
  /** Indica se o tour de demonstração está ativo no momento. */
  isDemoActive: boolean;
  /** Indica se o assistente de lançamento LaunchWizard está aberto (DOM ou query param). */
  isWizardOpen: boolean;
}

export const ACTIVE_DIALOG_SELECTOR =
  '[role="dialog"]:not([data-state="closed"]):not([data-lock-overlay]), ' +
  '[role="alertdialog"]:not([data-state="closed"])';

/**
 * Verifica no DOM a presença de diálogos ou modais ativos que não estejam fechados ou marcados como lock-overlay.
 */
export function hasActiveDialogInDom(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(ACTIVE_DIALOG_SELECTOR) !== null;
}

/**
 * Detecta se o LaunchWizard está aberto via parâmetros de busca na URL ou atributo específico no DOM.
 */
export function isLaunchWizardActive(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location.search;
  const hasUrlParam =
    search.includes("novo=") || search.includes("quick=") || search.includes("modo=rapido");

  if (hasUrlParam) return true;

  if (typeof document !== "undefined") {
    const el = document.querySelector(
      '[data-tour="launch-wizard"], [data-wizard-open="true"], [data-component="launch-wizard"]',
    );
    if (el) return true;
  }

  return false;
}

/**
 * Hook global de detecção de overlays ativos no sistema.
 * Utilizado para coordenar a exibição de toasts, banners de atualização e notificações,
 * evitando sobreposições indesejadas com modais e fluxos críticos de uso.
 */
export function useActiveOverlays(): ActiveOverlaysResult {
  const { isDemoActive } = useDemoSession();
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(() => hasActiveDialogInDom());
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(() => isLaunchWizardActive());

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const checkOverlays = () => {
      setIsDialogOpen(hasActiveDialogInDom());
      setIsWizardOpen(isLaunchWizardActive());
    };

    // Verificação inicial na montagem
    checkOverlays();

    // Monitora mutações no DOM (abertura e fechamento de modais Radix/primitivos)
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        checkOverlays();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "data-state",
          "role",
          "data-lock-overlay",
          "data-tour",
          "data-wizard-open",
        ],
      });
    }

    // Escuta eventos de navegação e histórico do navegador
    window.addEventListener("popstate", checkOverlays);
    window.addEventListener("hashchange", checkOverlays);

    return () => {
      observer?.disconnect();
      window.removeEventListener("popstate", checkOverlays);
      window.removeEventListener("hashchange", checkOverlays);
    };
  }, []);

  const hasBlockingOverlay = isDemoActive || isDialogOpen || isWizardOpen;

  return {
    hasBlockingOverlay,
    isDialogOpen,
    isDemoActive,
    isWizardOpen,
  };
}
