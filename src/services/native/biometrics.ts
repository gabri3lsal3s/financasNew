import { BiometricAuth, BiometryType } from "@aparajita/capacitor-biometric-auth";
import { isNativePlatform } from "./platform";

export const WEBAUTHN_CREDENTIAL_STORAGE_KEY = "axir_webauthn_credential_id";

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

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      str += String.fromCharCode(b);
    }
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function getStoredWebAuthnCredentialId(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage.getItem(WEBAUTHN_CREDENTIAL_STORAGE_KEY);
}

export function setStoredWebAuthnCredentialId(id: string | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (id) {
    window.localStorage.setItem(WEBAUTHN_CREDENTIAL_STORAGE_KEY, id);
  } else {
    window.localStorage.removeItem(WEBAUTHN_CREDENTIAL_STORAGE_KEY);
  }
}

export function clearWebAuthnPlatformCredential(): void {
  setStoredWebAuthnCredentialId(null);
}

/**
 * Registra uma credencial WebAuthn de plataforma local (Passkey biométrica) no navegador.
 */
export async function registerWebAuthnPlatformCredential(userId?: string | null): Promise<boolean> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.credentials) {
    return false;
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const rawUserId = userId ? new TextEncoder().encode(userId) : crypto.getRandomValues(new Uint8Array(16));
    const hostname = window.location.hostname || "localhost";

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "Axir",
          id: hostname,
        },
        user: {
          id: rawUserId,
          name: "usuario@axir",
          displayName: "Usuário Axir",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (credential?.rawId) {
      const base64Id = bufferToBase64Url(credential.rawId);
      setStoredWebAuthnCredentialId(base64Id);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Verifica a disponibilidade do sensor biométrico e se há suporte a credenciais na plataforma.
 * No APK: consulta BiometricAuth (@aparajita/capacitor-biometric-auth).
 * Na Web/PWA: consulta a API WebAuthn (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable).
 */
export async function checkBiometricsAvailability(): Promise<BiometricAvailability> {
  if (isNativePlatform()) {
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

  // Plataforma Web / PWA: Verificação via Web Authentication API (WebAuthn Platform Authenticator)
  if (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
  ) {
    try {
      const isAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return {
        isAvailable,
        biometryType: isAvailable ? "fingerprint" : "none",
        deviceIsSecure: isAvailable,
        reason: isAvailable ? undefined : "Sensor biométrico de plataforma não disponível no navegador.",
      };
    } catch {
      return {
        isAvailable: false,
        biometryType: "none",
        deviceIsSecure: false,
        reason: "Falha ao consultar autenticador biométrico de plataforma.",
      };
    }
  }

  return {
    isAvailable: false,
    biometryType: "none",
    deviceIsSecure: false,
    reason: "Navegador não possui suporte à autenticação biométrica (WebAuthn).",
  };
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
 * No APK: executa a BiometricPrompt nativa do Android via Capacitor.
 * Na Web/PWA: executa o desafio WebAuthn via Platform Authenticator (Touch ID, Windows Hello, Face ID, etc.).
 */
export async function authenticateWithBiometrics(
  reasonOrOptions?: string | { reason?: string; userId?: string | null },
): Promise<BiometricAuthResult> {
  const reasonText =
    typeof reasonOrOptions === "string"
      ? reasonOrOptions
      : reasonOrOptions?.reason ?? "Confirme sua identidade para acessar o Axir";

  const userId = typeof reasonOrOptions === "object" ? reasonOrOptions?.userId : null;

  if (authGraceTimer !== null) {
    clearTimeout(authGraceTimer);
    authGraceTimer = null;
  }
  isAuthenticating = true;

  try {
    if (isNativePlatform()) {
      await BiometricAuth.authenticate({
        reason: reasonText,
        cancelTitle: "Cancelar",
        allowDeviceCredential: true,
      });
      return { success: true };
    }

    // Fluxo Web / PWA (WebAuthn)
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.credentials ||
      typeof window.PublicKeyCredential === "undefined"
    ) {
      return { success: false, error: "Navegador não suporta biometria (WebAuthn)." };
    }

    const storedId = getStoredWebAuthnCredentialId();
    if (!storedId) {
      // Se não há credencial registrada ainda, tenta registrar uma nova vinculada ao sensor
      const registered = await registerWebAuthnPlatformCredential(userId);
      if (registered) {
        return { success: true };
      }
      return {
        success: false,
        error: "Biometria de plataforma não configurada ou cancelada pelo usuário.",
      };
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const rawId = base64UrlToBuffer(storedId);
    const hostname = window.location.hostname || "localhost";

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: hostname,
        allowCredentials: [
          {
            id: rawId,
            type: "public-key",
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });

    if (assertion) {
      return { success: true };
    }
    return { success: false, error: "Falha na validação biométrica do navegador." };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Falha na autenticação biométrica",
    };
  } finally {
    // Mantém a flag ativa por uma breve janela (800ms) para que os eventos
    // onPause/onResume ou visibilitychange não sejam interpretados como ida e volta do app.
    authGraceTimer = setTimeout(() => {
      isAuthenticating = false;
      authGraceTimer = null;
    }, 800);
  }
}
