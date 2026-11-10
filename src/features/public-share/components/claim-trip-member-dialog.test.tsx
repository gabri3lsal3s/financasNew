import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClaimTripMemberDialog } from "./claim-trip-member-dialog";
import * as tripsModule from "@/state/queries/use-trips";
import * as sensoryModule from "@/services/sensory";
import type { PublicTripMember } from "@/types/trips";

vi.mock("@/state/queries/use-trips", async (importOriginal) => {
  const actual = await importOriginal<typeof tripsModule>();
  return {
    ...actual,
    useClaimTripMemberMutation: vi.fn(),
  };
});

vi.mock("@/services/sensory");

const mockMembers: PublicTripMember[] = [
  {
    id: "m1",
    name: "Gabriel (Host)",
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
  {
    id: "m3",
    name: "Lucas",
    is_host: false,
    has_axis_account: false,
    pix_key: null,
    pix_key_type: null,
  },
];

function renderDialog(props: Partial<React.ComponentProps<typeof ClaimTripMemberDialog>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    tripTitle: "Mochilão Chapada",
    token: "token123",
    tripId: "trip-999",
    members: mockMembers,
    ...props,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <ClaimTripMemberDialog {...defaultProps} />
    </QueryClientProvider>
  );
}

describe("ClaimTripMemberDialog", () => {
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({
      success: true,
      trip_id: "trip-999",
      member_id: "m2",
      user_id: "user-abc",
    });

    vi.mocked(tripsModule.useClaimTripMemberMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof tripsModule.useClaimTripMemberMutation>);
  });

  it("renderiza apenas membros não vinculados (sem conta Axir) e exclui quem já possui conta", () => {
    renderDialog();

    expect(screen.getByText("Vincular Viagem à sua Conta")).toBeInTheDocument();
    expect(
      screen.getByText(/Selecione qual participante representa você em "Mochilão Chapada"/i)
    ).toBeInTheDocument();

    // Participantes elegíveis: Pedro e Lucas
    expect(screen.getByText("Pedro")).toBeInTheDocument();
    expect(screen.getByText("Lucas")).toBeInTheDocument();

    // Gabriel já possui conta (has_axis_account = true), logo não deve aparecer na lista
    expect(screen.queryByText("Gabriel (Host)")).not.toBeInTheDocument();
  });

  it("pré-seleciona o participante identificado no navegador e exibe badge contextual", () => {
    renderDialog({ initialSelectedMemberId: "m3" });

    expect(screen.getByText("Identificado no navegador")).toBeInTheDocument();
  });

  it("permite selecionar outro participante e aciona feedback tátil", async () => {
    const user = userEvent.setup();
    renderDialog({ initialSelectedMemberId: "m2" });

    const lucasButton = screen.getByRole("button", { name: /Lucas/i });
    await user.click(lucasButton);

    expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("selection");
  });

  it("renderiza campo de código de acesso quando hasPasscode for true", () => {
    renderDialog({ hasPasscode: true });

    expect(screen.getByLabelText(/Código de Acesso da Viagem/i)).toBeInTheDocument();
  });

  it("envia mutação de reivindicação com token, memberId e passcode, chamando onSuccess", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();

    renderDialog({
      hasPasscode: true,
      initialSelectedMemberId: "m2",
      onSuccess,
      onOpenChange,
    });

    const passInput = screen.getByLabelText(/Código de Acesso da Viagem/i);
    await user.type(passInput, "4321");

    const submitBtn = screen.getByRole("button", { name: "Confirmar e Vincular" });
    await user.click(submitBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      token: "token123",
      memberId: "m2",
      passcode: "4321",
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalledWith("trip-999");
  });

  it("exibe EmptyState quando todos os membros já tiverem conta vinculada", () => {
    const allClaimedMembers: PublicTripMember[] = [
      {
        id: "m1",
        name: "Gabriel",
        is_host: true,
        has_axis_account: true,
        pix_key: null,
        pix_key_type: null,
      },
    ];

    renderDialog({ members: allClaimedMembers });

    expect(screen.getByText("Nenhum participante disponível")).toBeInTheDocument();
    expect(
      screen.getByText("Todos os participantes desta viagem já possuem conta Axir vinculada.")
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Confirmar e Vincular" });
    expect(submitBtn).toBeDisabled();
  });
});
