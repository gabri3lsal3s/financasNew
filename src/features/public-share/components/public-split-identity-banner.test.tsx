import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PublicSplitIdentityBanner } from "./public-split-identity-banner";
import * as sensoryModule from "@/services/sensory";
import type { SplitParticipantItem } from "@/types";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

const mockParticipants: SplitParticipantItem[] = [
  {
    id: "p_1",
    name: "Gabriel Sales",
    share_cents: 4000,
    is_host: true,
  },
  {
    id: "p_2",
    name: "Mariana",
    share_cents: 4000,
    is_host: false,
  },
  {
    id: "p_3",
    name: "Lucas",
    share_cents: 4000,
    is_host: false,
  },
];

describe("PublicSplitIdentityBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  describe("Estado 1: Sem identidade ativa", () => {
    it("renderiza título 'Quem é você neste racha?' e botões dos participantes", () => {
      render(
        <PublicSplitIdentityBanner
          token="test-token"
          participants={mockParticipants}
          hostName="Gabriel Sales"
        />
      );

      expect(screen.getByText("Quem é você neste racha?")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Selecione seu nome para visualizar sua cota, parcelas e realizar o pagamento Pix diretamente."
        )
      ).toBeInTheDocument();

      expect(screen.getByRole("button", { name: /Gabriel Sales/i })).toBeInTheDocument();
      expect(screen.getByText("(Organizador)")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mariana" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Lucas" })).toBeInTheDocument();
    });

    it("aciona callback onSelectParticipant e salva no localStorage ao clicar em um participante", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <PublicSplitIdentityBanner
          token="test-token"
          participants={mockParticipants}
          hostName="Gabriel Sales"
          onSelectParticipant={onSelect}
        />
      );

      const marianaBtn = screen.getByRole("button", { name: "Mariana" });
      await user.click(marianaBtn);

      expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("selection");
      expect(onSelect).toHaveBeenCalledWith("p_2");
      expect(window.localStorage.getItem("axis_guest_split_test-token")).toBe("p_2");
    });
  });

  describe("Estado 2: Com identidade ativa", () => {
    it("exibe badge 'Você é Mariana' e botão 'Alterar'", () => {
      render(
        <PublicSplitIdentityBanner
          token="test-token"
          participants={mockParticipants}
          hostName="Gabriel Sales"
          activeParticipantId="p_2"
        />
      );

      expect(screen.getByText("Você é Mariana")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Alterar/i })).toBeInTheDocument();
    });

    it("exibe '(Organizador)' se o participante ativo for o anfitrião", () => {
      render(
        <PublicSplitIdentityBanner
          token="test-token"
          participants={mockParticipants}
          hostName="Gabriel Sales"
          activeParticipantId="p_1"
        />
      );

      expect(screen.getByText(/Você é Gabriel Sales \(Organizador\)/i)).toBeInTheDocument();
    });

    it("ao clicar em 'Alterar', limpa a identidade e volta ao estado inicial", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      window.localStorage.setItem("axis_guest_split_test-token", "p_2");

      const { rerender } = render(
        <PublicSplitIdentityBanner
          token="test-token"
          participants={mockParticipants}
          hostName="Gabriel Sales"
          activeParticipantId="p_2"
          onSelectParticipant={onSelect}
        />
      );

      const changeBtn = screen.getByRole("button", { name: /Alterar/i });
      await user.click(changeBtn);

      expect(onSelect).toHaveBeenCalledWith(null);
      expect(window.localStorage.getItem("axis_guest_split_test-token")).toBeNull();

      // Rerender sem activeParticipantId fixo
      rerender(
        <PublicSplitIdentityBanner
          token="test-token"
          participants={mockParticipants}
          hostName="Gabriel Sales"
          activeParticipantId={null}
          onSelectParticipant={onSelect}
        />
      );

      expect(screen.getByText("Quem é você neste racha?")).toBeInTheDocument();
    });
  });
});
