/**
 * Bloqueio estrito de orientação mobile (portrait only).
 *
 * Combinado com o manifest (`orientation: "portrait"` + `display: "standalone"`):
 *   1. `screen.orientation.lock("portrait")` — trava a UI no PWA instalado e em
 *      navegadores que suportam a API (Chrome Android/desktop, etc.);
 *   2. Store externo `isLandscapeMobile()` — detecta paisagem em tela de toque
 *      e alimenta o overlay de fallback (navegadores sem suporte à API: iOS
 *      Safari, Chrome não-instalado), que pede ao usuário girar o dispositivo.
 *
 * Segue o padrão de store externo do projeto (pwa.ts / calculator-open.ts):
 * subscribe/getSnapshot consumidos via `useSyncExternalStore`.
 */

/** Suporte da API de lock de orientação. */
function hasOrientationLock(): boolean {
  const orientation = (screen as Screen & { orientation?: ScreenOrientation }).orientation;
  return typeof orientation?.lock === "function";
}

/**
 * Tenta travar a orientação em retrato. No-op silencioso quando a API não
 * existe ou o navegador recusa (ex.: página não-standalone) — nesses casos o
 * overlay de fallback cobre.
 */
export function lockPortrait(): void {
  if (!hasOrientationLock()) return;
  try {
    void (screen as Screen & { orientation: ScreenOrientation }).orientation
      .lock("portrait")
      .catch(() => {
        // Navegador recusou o lock (não-standalone/fullscreen) — fallback visual.
      });
  } catch {
    // Sem suporte — fallback visual.
  }
}

// ---------------------------------------------------------------------------
// Store externo — "está em paisagem num dispositivo móvel?"
// ---------------------------------------------------------------------------

let landscapeMobile = false;
const listeners = new Set<() => void>();

function detectLandscapeMobile(): boolean {
  if (typeof window === "undefined") return false;
  const isTouch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const isLandscape = window.innerWidth > window.innerHeight;
  return isTouch && isLandscape;
}

/** Estado atual (getSnapshot do useSyncExternalStore). */
export function isLandscapeMobile(): boolean {
  return landscapeMobile;
}

/**
 * Zera o estado (usado em testes/limpeza — mesmo padrão de `setCalculatorOpen`
 * para stores externos do projeto). Não remove os listeners da janela.
 */
export function resetOrientationLock(): void {
  if (landscapeMobile === false) return;
  landscapeMobile = false;
  for (const listener of listeners) listener();
}

/** Assinatura para a UI reagir à mudança de orientação (overlay). */
export function subscribeOrientationLock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function refresh(): void {
  const next = detectLandscapeMobile();
  if (next === landscapeMobile) return;
  landscapeMobile = next;
  for (const listener of listeners) listener();
}

/**
 * Inicializa o bloqueio: aplica o lock e observa a orientação/tamanho da
 * tela para o overlay de fallback. Chamado uma vez no bootstrap.
 */
export function initOrientationLock(): () => void {
  lockPortrait();
  refresh();

  window.addEventListener("resize", refresh);
  window.addEventListener("orientationchange", refresh);
  // Reaplica o lock ao voltar de fullscreen (o navegador pode liberar a trava).
  document.addEventListener("fullscreenchange", lockPortrait);

  return () => {
    window.removeEventListener("resize", refresh);
    window.removeEventListener("orientationchange", refresh);
    document.removeEventListener("fullscreenchange", lockPortrait);
  };
}
