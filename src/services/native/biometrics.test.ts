import { BiometricAuth, BiometryType } from "@aparajita/capacitor-biometric-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateWithBiometrics, checkBiometricsAvailability } from "./biometrics";
import * as platformModule from "./platform";

vi.mock("@aparajita/capacitor-biometric-auth", () => ({
  BiometricAuth: {
    checkBiometry: vi.fn(),
    authenticate: vi.fn(),
  },
  BiometryType: {
    none: 0,
    touchId: 1,
    faceId: 2,
    fingerprintAuthentication: 3,
    faceAuthentication: 4,
    irisAuthentication: 5,
  },
}));

describe("Gateway Nativo — Biometria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("informa indisponibilidade e erro seguro em Web/PWA quando WebAuthn não estiver presente", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    const originalPKC = window.PublicKeyCredential;
    // @ts-expect-error test override
    delete window.PublicKeyCredential;

    const availability = await checkBiometricsAvailability();
    expect(availability.isAvailable).toBe(false);
    expect(availability.biometryType).toBe("none");

    const auth = await authenticateWithBiometrics();
    expect(auth.success).toBe(false);

    window.PublicKeyCredential = originalPKC;
  });

  it("detecta autenticador de plataforma WebAuthn disponível no navegador", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    const isAvailableMock = vi.fn().mockResolvedValue(true);
    // @ts-expect-error mock WebAuthn
    window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: isAvailableMock,
    };

    const availability = await checkBiometricsAvailability();
    expect(availability.isAvailable).toBe(true);
    expect(availability.biometryType).toBe("fingerprint");
    expect(availability.deviceIsSecure).toBe(true);
  });

  it("executa registro e autenticação WebAuthn com sucesso no navegador", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    // @ts-expect-error mock WebAuthn
    window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
    };

    const mockRawId = new Uint8Array([1, 2, 3, 4]).buffer;
    const mockCreate = vi.fn().mockResolvedValue({ rawId: mockRawId });
    const mockGet = vi.fn().mockResolvedValue({ id: "cred-123" });

    Object.defineProperty(navigator, "credentials", {
      value: {
        create: mockCreate,
        get: mockGet,
      },
      configurable: true,
      writable: true,
    });

    // 1. Registro e primeira autenticação
    const firstAuth = await authenticateWithBiometrics({ reason: "Ativar biometria", userId: "user-123" });
    expect(firstAuth.success).toBe(true);
    expect(mockCreate).toHaveBeenCalled();

    // 2. Autenticação subsequente usando a credencial armazenada
    const secondAuth = await authenticateWithBiometrics({ reason: "Desbloquear" });
    expect(secondAuth.success).toBe(true);
    expect(mockGet).toHaveBeenCalled();
  });

  it("detecta biometria de impressão digital disponível", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.mocked(BiometricAuth.checkBiometry).mockResolvedValue({
      isAvailable: true,
      strongBiometryIsAvailable: true,
      biometryType: BiometryType.fingerprintAuthentication,
      biometryTypes: [BiometryType.fingerprintAuthentication],
      deviceIsSecure: true,
      reason: "",
      code: "" as never,
    });

    const availability = await checkBiometricsAvailability();
    expect(availability.isAvailable).toBe(true);
    expect(availability.biometryType).toBe("fingerprint");
    expect(availability.deviceIsSecure).toBe(true);
  });

  it("detecta biometria facial disponível", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.mocked(BiometricAuth.checkBiometry).mockResolvedValue({
      isAvailable: true,
      strongBiometryIsAvailable: true,
      biometryType: BiometryType.faceAuthentication,
      biometryTypes: [BiometryType.faceAuthentication],
      deviceIsSecure: true,
      reason: "",
      code: "" as never,
    });

    const availability = await checkBiometricsAvailability();
    expect(availability.isAvailable).toBe(true);
    expect(availability.biometryType).toBe("face");
  });

  it("executa autenticação biométrica com sucesso", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.mocked(BiometricAuth.authenticate).mockResolvedValue(undefined);

    const result = await authenticateWithBiometrics("Acessar saldos");
    expect(result.success).toBe(true);
    expect(BiometricAuth.authenticate).toHaveBeenCalledWith({
      reason: "Acessar saldos",
      cancelTitle: "Cancelar",
      allowDeviceCredential: true,
    });
  });

  it("trata erro e cancelamento de autenticação biométrica com segurança", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.mocked(BiometricAuth.authenticate).mockRejectedValue(new Error("Usuário cancelou"));

    const result = await authenticateWithBiometrics();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Usuário cancelou");
  });
});
