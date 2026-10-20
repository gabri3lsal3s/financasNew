/**
 * Regras puras para exibição e controle de dispensa do aviso promocional do APK Android Pro.
 *
 * Garante que o convite para experimentar a automação bancária em segundo plano
 * seja exibido exclusivamente para usuários em dispositivos Android (Web/PWA),
 * respeitando o período de dispensa temporária (ex: 7 dias ao fechar).
 */

export interface ShouldShowApkPromoParams {
  /** Se o aplicativo já está rodando como app nativo compilado (Capacitor). */
  isNative: boolean;
  /** Se o dispositivo do usuário é um smartphone/tablet Android. */
  isAndroid: boolean;
  /** Timestamp ISO ou numérico até quando o aviso foi dispensado pelo usuário. */
  dismissedUntil?: string | number | null;
  /** Data atual (injetável para testes determinísticos). */
  now?: Date;
}

export const APK_PROMO_DISMISS_DAYS = 7;
export const APK_PROMO_STORAGE_KEY = "axis_dismiss_apk_promo_until";

/**
 * Avalia se o banner/sugestão do APK Android Pro deve ser apresentado ao usuário.
 */
export function shouldShowApkPromo(params: ShouldShowApkPromoParams): boolean {
  // Se já está no app nativo compilado, não faz sentido sugerir baixar o APK
  if (params.isNative) {
    return false;
  }

  // Só exibe se o dispositivo for Android (usuários iOS/desktop não instalam APK)
  if (!params.isAndroid) {
    return false;
  }

  // Verifica se o usuário dispensou o aviso recentemente
  if (params.dismissedUntil) {
    const nowMs = (params.now ?? new Date()).getTime();
    const untilMs =
      typeof params.dismissedUntil === "number"
        ? params.dismissedUntil
        : new Date(params.dismissedUntil).getTime();

    if (!Number.isNaN(untilMs) && untilMs > nowMs) {
      return false;
    }
  }

  return true;
}

/**
 * Calcula o timestamp numérico para dispensa futura a partir de agora.
 */
export function computeDismissUntilTimestamp(days = APK_PROMO_DISMISS_DAYS, now = new Date()): number {
  return now.getTime() + days * 24 * 60 * 60 * 1000;
}
