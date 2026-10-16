import { BiometricAuth, BiometryType } from "@aparajita/capacitor-biometric-auth";
import { isNativePlatform } from "./platform";

export interface BiometricAvailability {
  isAvailable: boolean;
  biometryType: "fingerprint" | "face" | "iris" | "none";
  deviceIsSecure: boolean;
  reason?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

/**
 * Verifica a disponibilidade do sensor biométrico e se há credenciais cadastradas.
 * Na Web/PWA, opera com degradação graciosa informando indisponibilidade nativa.
 */
export async function checkBiometricsAvailability(): Promise<BiometricAvailability> {
  if (!isNativePlatform()) {
    return {
      isAvailable: false,
      biometryType: "none",
      deviceIsSecure: false,
      reason: "Disponível exclusivamente no aplicativo instalado",
    };
  }

  try {
    const result = await BiometricAuth.checkBiometry();
    let type: "fingerprint" | "face" | "iris" | "none" = "none";
    if (
      result.biometryType === BiometryType.fingerprintAuthentication ||
      result.biometryType === BiometryType.touchId
    ) {
      type = "fingerprint";
    } else if (
      result.biometryType === BiometryType.faceAuthentication ||
      result.biometryType === BiometryType.faceId
    ) {
      type = "face";
    } else if (result.biometryType === BiometryType.irisAuthentication) {
      type = "iris";
    }

    return {
      isAvailable: result.isAvailable,
      biometryType: type,
      deviceIsSecure: result.deviceIsSecure,
      reason: result.reason,
    };
  } catch (err) {
    return {
      isAvailable: false,
      biometryType: "none",
      deviceIsSecure: false,
      reason: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

let isAuthenticating = false;
let authGraceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Indica se uma solicitação de autenticação biométrica do sistema está aberta ou
 * acabou de fechar, prevenindo falsos disparos de eventos de background/appStateChange.
 */
export function isBiometricAuthInProgress(): boolean {
  return isAuthenticating;
}

/**
 * Solicita autenticação biométrica (impressão digital ou face).
 * Em Web/PWA, opera como no-op seguro permitindo acesso transparente.
 */
export async function authenticateWithBiometrics(
  reasonOrOptions?: string | { reason?: string },
): Promise<BiometricAuthResult> {
  const reasonText =
    typeof reasonOrOptions === "string"
      ? reasonOrOptions
      : reasonOrOptions?.reason ?? "Confirme sua identidade para acessar o Áxis • Guia Financeiro";

  if (!isNativePlatform()) {
    return { success: true };
  }

  if (authGraceTimer !== null) {
    clearTimeout(authGraceTimer);
    authGraceTimer = null;
  }
  isAuthenticating = true;

  try {
    await BiometricAuth.authenticate({
      reason: reasonText,
      cancelTitle: "Cancelar",
      allowDeviceCredential: true,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Falha na autenticação biométrica",
    };
  } finally {
    // Mantém a flag ativa por uma breve janela (800ms) para que os eventos
    // onPause/onResume emitidos pelo SO ao fechar a BiometricPrompt nativa
    // não sejam interpretados como ida e volta do app em segundo plano.
    authGraceTimer = setTimeout(() => {
      isAuthenticating = false;
      authGraceTimer = null;
    }, 800);
  }
}
