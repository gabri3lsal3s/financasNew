import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApkBetaRestrictedModal } from "./apk-beta-restricted-modal";

const mockIsNativePlatform = vi.fn();
const mockUseAuth = vi.fn();
const mockUseSignOut = vi.fn();
const mockUseUserAccess = vi.fn();
const mockUseUserSubscription = vi.fn();
const mockSignOutFn = vi.fn();

vi.mock("@/services/native/platform", () => ({
  isNativePlatform: () => mockIsNativePlatform(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => mockUseSignOut(),
}));

vi.mock("@/state", () => ({
  useUserAccess: () => mockUseUserAccess(),
  useUserSubscription: () => mockUseUserSubscription(),
}));

vi.mock("@/services/app-url", () => ({
  getPublicAppUrl: (path: string) => `https://app.axis.com${path}`,
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("ApkBetaRestrictedModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSignOut.mockReturnValue({ signOut: mockSignOutFn });
  });

  it("não renderiza nada se não estiver em plataforma nativa (Web / PWA)", () => {
    mockIsNativePlatform.mockReturnValue(false);
    mockUseAuth.mockReturnValue({ session: { user: { id: "u-1" } } });
    mockUseUserAccess.mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(false),
      isAdmin: false,
      isLoading: false,
    });
    mockUseUserSubscription.mockReturnValue({ isPro: false });

    const { container } = render(<ApkBetaRestrictedModal />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada se for operador com papel de administrador", () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockUseAuth.mockReturnValue({ session: { user: { id: "u-admin" } } });
    mockUseUserAccess.mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(false),
      isAdmin: true,
      isLoading: false,
    });
    mockUseUserSubscription.mockReturnValue({ isPro: true });

    const { container } = render(<ApkBetaRestrictedModal />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada se o APK estiver liberado para o plano do usuário (apk_access_free)", () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockUseAuth.mockReturnValue({ session: { user: { id: "u-free" } } });
    mockUseUserAccess.mockReturnValue({
      hasFeature: (key: string) => key === "apk_access_free",
      isAdmin: false,
      isLoading: false,
    });
    mockUseUserSubscription.mockReturnValue({ isPro: false });

    const { container } = render(<ApkBetaRestrictedModal />);
    expect(container).toBeEmptyDOMElement();
  });

  it("exibe o modal bloqueador quando o acesso ao APK estiver desabilitado", async () => {
    const user = userEvent.setup();
    mockIsNativePlatform.mockReturnValue(true);
    mockUseAuth.mockReturnValue({ session: { user: { id: "u-restricted" } } });
    mockUseUserAccess.mockReturnValue({
      hasFeature: () => false,
      isAdmin: false,
      isLoading: false,
    });
    mockUseUserSubscription.mockReturnValue({ isPro: false });

    render(<ApkBetaRestrictedModal />);

    expect(screen.getByText("Acesso Beta ao Aplicativo Nativo")).toBeInTheDocument();
    expect(screen.getByText(/Aplicativo Nativo em Testes Fechados/i)).toBeInTheDocument();
    expect(screen.getByText("Acessar via Web / Navegador")).toBeInTheDocument();

    const signOutBtn = screen.getByRole("button", { name: /Sair da conta/i });
    await user.click(signOutBtn);
    expect(mockSignOutFn).toHaveBeenCalledTimes(1);
  });
});
