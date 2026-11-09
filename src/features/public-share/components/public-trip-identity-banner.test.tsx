import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router";
import { PublicTripIdentityBanner } from "./public-trip-identity-banner";
import * as authHook from "@/hooks/use-auth";
import * as sensoryModule from "@/services/sensory";
import type { PublicTripMember, TripMemberBalance } from "@/types/trips";

vi.mock("@/hooks/use-auth");
vi.mock("@/services/sensory");

const mockMembers: PublicTripMember[] = [
  {
    id: "m1",
    name: "Gabriel",
    is_host: true,
    has_axis_account: true,
    pix_key: "gabriel@axis.app",
    pix_key_type: "email",
  },
  {
    id: "m2",
    name: "Pedro",
    is_host: false,
    has_axis_account: false,
    pix_key: null,
    pix_key_type: null,
  },
];

const mockBalancePedro: TripMemberBalance = {
  memberId: "m2",
  name: "Pedro",
  totalPaidCents: 5000,
  totalOwedCents: 15000,
  netBalanceCents: -10000,
};

function renderBanner(props: Partial<React.ComponentProps<typeof PublicTripIdentityBanner>> = {}) {
  const defaultProps = {
    token: "token123",
    members: mockMembers,
    ...props,
  };

  return render(
    <BrowserRouter>
      <PublicTripIdentityBanner {...defaultProps} />
    </BrowserRouter>
  );
}

describe("PublicTripIdentityBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(authHook.useAuth).mockReturnValue({ session: null } as unknown as ReturnType<typeof authHook.useAuth>);
  });

  describe("Estado 1: Sem identidade ativa", () => {
    it("renderiza título 'Quem é você nesta viagem?' e botões de todos os participantes", () => {
      renderBanner({ activeMemberId: null });

      expect(screen.getByText("Quem é você nesta viagem?")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Selecione seu nome para facilitar lançamentos e visualizar seu rateio individual."
        )
      ).toBeInTheDocument();

      const gabrielBtn = screen.getByRole("button", { name: /Gabriel/i });
      expect(gabrielBtn).toBeInTheDocument();
      expect(screen.getByText("(Organizador)")).toBeInTheDocument();

      const pedroBtn = screen.getByRole("button", { name: "Pedro" });
      expect(pedroBtn).toBeInTheDocument();
    });

    it("exibe banner discreto de login quando visitante não está autenticado", () => {
      vi.mocked(authHook.useAuth).mockReturnValue({ session: null } as unknown as ReturnType<typeof authHook.useAuth>);

      renderBanner({ activeMemberId: null, token: "tok_viagem_abc" });

      const loginLink = screen.getByRole("link", {
        name: /Entrar com minha conta Áxis para sincronizar com meu extrato/i,
      });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute(
        "href",
        "/entrar?redirect=%2Fviagem%2Ftok_viagem_abc"
      );
    });

    it("oculta banner de login quando usuário já estiver autenticado no app", () => {
      vi.mocked(authHook.useAuth).mockReturnValue({
        session: { user: { id: "user_1" } },
      } as unknown as ReturnType<typeof authHook.useAuth>);

      renderBanner({ activeMemberId: null });

      expect(
        screen.queryByText(/Entrar com minha conta Áxis para sincronizar com meu extrato/i)
      ).not.toBeInTheDocument();
    });

    it("exibe atalho de vínculo e aciona onClaimAccount quando autenticado e fornecido", async () => {
      const user = userEvent.setup();
      const onClaim = vi.fn();
      vi.mocked(authHook.useAuth).mockReturnValue({
        session: { user: { id: "user_1" } },
      } as unknown as ReturnType<typeof authHook.useAuth>);

      renderBanner({ activeMemberId: null, onClaimAccount: onClaim });

      const claimBtn = screen.getByText(/Vincular esta viagem ao meu aplicativo Áxis/i);
      expect(claimBtn).toBeInTheDocument();

      await user.click(claimBtn);
      expect(onClaim).toHaveBeenCalledTimes(1);
    });

    it("aciona callback e gateway sensorial ao clicar em um participante", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      renderBanner({ activeMemberId: null, onSelectMember: onSelect });

      const pedroBtn = screen.getByRole("button", { name: "Pedro" });
      await user.click(pedroBtn);

      expect(onSelect).toHaveBeenCalledWith("m2");
      expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("selection");
      expect(window.localStorage.getItem("axis_guest_member_token123")).toBe("m2");
    });
  });

  describe("Estado 2: Com identidade ativa", () => {
    it("renderiza badge 'Você é [Nome]' e botão 'Alterar'", () => {
      renderBanner({ activeMemberId: "m2" });

      expect(screen.getByText("Você é Pedro")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /alterar/i })).toBeInTheDocument();
      expect(screen.queryByText("Quem é você nesta viagem?")).not.toBeInTheDocument();
    });

    it("identifica corretamente o organizador na badge ativa", () => {
      renderBanner({ activeMemberId: "m1" });

      expect(screen.getByText("Você é Gabriel (Organizador)")).toBeInTheDocument();
    });

    it("renderiza dados de balanço financeiro quando fornecidos", () => {
      renderBanner({ activeMemberId: "m2", balance: mockBalancePedro });

      expect(screen.getByText("Você pagou no total:")).toBeInTheDocument();
      expect(screen.getByText("R$ 50,00")).toBeInTheDocument();
      expect(screen.getByText("Sua cota nas despesas:")).toBeInTheDocument();
      expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
      expect(screen.getByText("Você deve R$ 100,00")).toBeInTheDocument();
    });

    it("renderiza badge de recebimento quando netBalance for positivo", () => {
      const positiveBalance: TripMemberBalance = {
        memberId: "m1",
        name: "Gabriel",
        totalPaidCents: 20000,
        totalOwedCents: 10000,
        netBalanceCents: 10000,
      };

      renderBanner({ activeMemberId: "m1", balance: positiveBalance });

      expect(screen.getByText("Você tem R$ 100,00 a receber")).toBeInTheDocument();
    });

    it("renderiza badge 'Contas equilibradas' quando netBalance for zero", () => {
      const zeroBalance: TripMemberBalance = {
        memberId: "m1",
        name: "Gabriel",
        totalPaidCents: 10000,
        totalOwedCents: 10000,
        netBalanceCents: 0,
      };

      renderBanner({ activeMemberId: "m1", balance: zeroBalance });

      expect(screen.getByText("Contas equilibradas")).toBeInTheDocument();
    });

    it("aciona callback onOpenStatement ao clicar no extrato detalhado", async () => {
      const user = userEvent.setup();
      const onOpenStatement = vi.fn();

      renderBanner({
        activeMemberId: "m2",
        balance: mockBalancePedro,
        onOpenStatement,
      });

      const statementBtn = screen.getByRole("button", {
        name: /Ver Extrato Detalhado do Meu Rateio/i,
      });
      await user.click(statementBtn);

      expect(onOpenStatement).toHaveBeenCalledWith(mockMembers[1]);
    });

    it("ao clicar em 'Alterar', chama onSelectMember(null) e limpa o localStorage", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      window.localStorage.setItem("axis_guest_member_token123", "m2");

      renderBanner({ activeMemberId: "m2", onSelectMember: onSelect });

      const changeBtn = screen.getByRole("button", { name: /alterar/i });
      await user.click(changeBtn);

      expect(onSelect).toHaveBeenCalledWith(null);
      expect(window.localStorage.getItem("axis_guest_member_token123")).toBeNull();
      expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("selection");
    });
  });

  describe("Persistência com usePublicTripGuestIdentity", () => {
    it("lê identidade gravada no localStorage quando activeMemberId não for explicitamente fornecido", () => {
      window.localStorage.setItem("axis_guest_member_token123", "m1");

      renderBanner({ activeMemberId: undefined });

      expect(screen.getByText("Você é Gabriel (Organizador)")).toBeInTheDocument();
    });
  });
});
