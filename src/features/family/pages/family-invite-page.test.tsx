import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { FamilyInvitePage } from "./family-invite-page";
import * as authHook from "@/hooks/use-auth";
import * as familyHooks from "@/state/queries/use-family";
import * as toastService from "@/services/toast";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/state/queries/use-family", () => ({
  useFamilyInvite: vi.fn(),
  useMyFamily: vi.fn(),
  useAcceptFamilyInvite: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("FamilyInvitePage (/convite-familiar/:token)", () => {
  const mutateAsyncMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authHook.useAuth).mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    vi.mocked(familyHooks.useMyFamily).mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    vi.mocked(familyHooks.useAcceptFamilyInvite).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof familyHooks.useAcceptFamilyInvite>);
  });

  function renderPage(token = "tok-123") {
    return render(
      <MemoryRouter initialEntries={[`/convite-familiar/${token}`]}>
        <Routes>
          <Route path="/convite-familiar/:token" element={<FamilyInvitePage />} />
          <Route path="/familia" element={<div>Página Orçamento Familiar</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("renderiza skeleton de carregamento enquanto o convite está sendo consultado", () => {
    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    const { container } = renderPage();
    expect(container.querySelectorAll(".animate-shimmer").length).toBeGreaterThan(0);
  });

  it("exibe estado vazio de convite não encontrado ou inválido", async () => {
    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    renderPage();

    expect(screen.getByText("Convite não encontrado ou inválido")).toBeInTheDocument();
    expect(
      screen.getByText(/O link acessado não corresponde a nenhum convite ativo no momento/i),
    ).toBeInTheDocument();
  });

  it("exibe aviso quando o convite foi revogado pelo titular", async () => {
    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: {
        id: "inv-1",
        token: "tok-123",
        status: "revoked",
        expires_at: "2099-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    renderPage();

    expect(screen.getByText("Este convite foi cancelado")).toBeInTheDocument();
  });

  it("exibe aviso quando o convite expirou (status expired ou data passada)", async () => {
    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: {
        id: "inv-1",
        token: "tok-123",
        status: "expired",
        expires_at: "2020-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    renderPage();

    expect(screen.getByText("Este convite expirou")).toBeInTheDocument();
  });

  it("exibe aviso quando o convite já foi aceito anteriormente", async () => {
    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: {
        id: "inv-1",
        token: "tok-123",
        status: "accepted",
        expires_at: "2099-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    renderPage();

    expect(screen.getByText("Este convite já foi aceito")).toBeInTheDocument();
  });

  it("exibe card de gerenciamento quando o usuário autenticado é o criador do convite", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-creator" } } as unknown as authHook.AuthState["session"],
      user: { id: "user-creator" } as unknown as authHook.AuthState["user"],
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: {
        id: "inv-1",
        family_id: "fam-1",
        invited_by: "user-creator",
        family_name: "Família Costa",
        token: "tok-123",
        status: "pending",
        expires_at: "2099-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    renderPage();

    expect(screen.getByText("Você é o criador deste convite")).toBeInTheDocument();
    expect(screen.getByText(/Família Costa/i)).toBeInTheDocument();

    // Testa ação de cópia do link
    const copyButton = screen.getByRole("button", { name: /Copiar Link/i });
    expect(copyButton).toBeInTheDocument();

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    await user.click(copyButton);
    expect(writeTextMock).toHaveBeenCalled();
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Link de convite copiado!",
      }),
    );
  });

  it("exibe aviso quando o usuário já pertence à mesma família do convite", async () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-member" } } as unknown as authHook.AuthState["session"],
      user: { id: "user-member" } as unknown as authHook.AuthState["user"],
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: {
        id: "inv-1",
        family_id: "fam-1",
        invited_by: "user-other",
        family_name: "Família Costa",
        token: "tok-123",
        status: "pending",
        expires_at: "2099-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    vi.mocked(familyHooks.useMyFamily).mockReturnValue({
      data: {
        family: { id: "fam-1", name: "Família Costa" },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderPage();

    expect(screen.getByText("Você já faz parte desta família")).toBeInTheDocument();
  });

  it("exibe aviso quando o usuário já pertence a outra família ativa", async () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-member" } } as unknown as authHook.AuthState["session"],
      user: { id: "user-member" } as unknown as authHook.AuthState["user"],
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: {
        id: "inv-1",
        family_id: "fam-1",
        invited_by: "user-other",
        family_name: "Família Costa",
        token: "tok-123",
        status: "pending",
        expires_at: "2099-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    vi.mocked(familyHooks.useMyFamily).mockReturnValue({
      data: {
        family: { id: "fam-2", name: "Outra Família Ativa" },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderPage();

    expect(screen.getByText("Você já pertence a outra família ativa")).toBeInTheDocument();
    expect(screen.getByText(/Para entrar na família Família Costa/i)).toBeInTheDocument();
  });

  it("renderiza tela de recepção para visitantes não autenticados com CTAs de cadastro e login", () => {
    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: {
        id: "inv-1",
        family_id: "fam-1",
        invited_by: "user-owner",
        inviter_name: "Mariana Silva",
        family_name: "Família Silva",
        token: "tok-123",
        status: "pending",
        expires_at: "2099-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    renderPage("tok-123");

    expect(screen.getByText("Mariana Silva convidou você!")).toBeInTheDocument();
    expect(screen.getByText(/Família Silva/i)).toBeInTheDocument();
    expect(screen.getByText("Privacidade Sagrada (Zero Data Bleed)")).toBeInTheDocument();
    expect(screen.getByText("Orçamento e Tetos Compartilhados")).toBeInTheDocument();

    const registerLink = screen.getByRole("link", { name: /Criar Conta Gratuita e Aceitar/i });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute(
      "href",
      "/cadastro?redirect=%2Fconvite-familiar%2Ftok-123",
    );

    const loginLink = screen.getByRole("link", { name: /Já tenho uma conta — Fazer Login/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/entrar?redirect=%2Fconvite-familiar%2Ftok-123");
  });

  it("permite que parceiro autenticado e elegível preencha nome e chave Pix e aceite o convite", async () => {
    const user = userEvent.setup();

    vi.mocked(authHook.useAuth).mockReturnValue({
      session: {
        user: { id: "user-partner", user_metadata: { name: "Lucas P." } },
      } as unknown as authHook.AuthState["session"],
      user: { id: "user-partner" } as unknown as authHook.AuthState["user"],
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    vi.mocked(familyHooks.useFamilyInvite).mockReturnValue({
      data: {
        id: "inv-1",
        family_id: "fam-1",
        invited_by: "user-owner",
        inviter_name: "Mariana",
        family_name: "Família Feliz",
        token: "tok-123",
        status: "pending",
        expires_at: "2099-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof familyHooks.useFamilyInvite>);

    mutateAsyncMock.mockResolvedValueOnce({
      success: true,
      family_id: "fam-1",
      role: "member",
    });

    renderPage("tok-123");

    expect(screen.getByText("Mariana convidou você!")).toBeInTheDocument();
    expect(screen.getByText(/Família Feliz/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacidade 100% Preservada/i)).toBeInTheDocument();

    // Nome pré-preenchido pelo user_metadata
    const nameInput = screen.getByLabelText(/Seu Nome de Exibição na Família/i);
    expect(nameInput).toHaveValue("Lucas P.");

    // Preenche chave Pix
    const pixInput = screen.getByPlaceholderText(/seu-pix@email.com/i);
    await user.type(pixInput, "lucas@pix.me");

    // Clica no botão de aceitar
    const acceptButton = screen.getByRole("button", {
      name: /Aceitar Convite e Entrar na Família/i,
    });
    await user.click(acceptButton);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        token: "tok-123",
        displayName: "Lucas P.",
        pixKey: "lucas@pix.me",
        pixKeyType: "cpf",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/familia", { replace: true });
  });
});
