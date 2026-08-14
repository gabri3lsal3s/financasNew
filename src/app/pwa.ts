import { registerSW } from "virtual:pwa-register";

/**
 * Registra o service worker (autoUpdate) — ver docs/PWA_GUIDELINES.md.
 * O SW cacheia apenas o App Shell e assets estáticos; dados seguem Online First.
 */
export function registerPWA(): void {
  registerSW({ immediate: true });
}
