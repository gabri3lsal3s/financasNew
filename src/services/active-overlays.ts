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
      '[data-tour="launch-wizard"], [data-tour="launch-wizard-dialog"], [data-wizard-open="true"], [data-component="launch-wizard"]',
    );
    if (el) return true;
  }

  return false;
}
