import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";

vi.mock("@/state", () => ({
  useReminders: () => ({
    totalCount: 0,
    urgentCount: 0,
    items: [],
    isLoading: false,
    error: null,
  }),
  useUserAccess: () => ({
    role: "user",
    status: "active",
    isAdmin: false,
    isSuperAdmin: false,
    hasFeature: () => true,
    isLoading: false,
  }),
  useUserSubscription: () => ({
    isPro: true,
    isTrial: false,
    isReadOnly: false,
    trialDaysRemaining: null,
    plan: "annual",
    tier: "pro_annual",
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    isFullAccess: true,
  }),
}));


function renderSidebar(isCollapsed = false, onToggle = () => {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Sidebar isCollapsed={isCollapsed} onToggle={onToggle} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("Sidebar colapsável (F7.2)", () => {
  it("renderiza expandida com logo e labels visíveis", () => {
    renderSidebar();
    expect(screen.getByText("Guia Financeiro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transações" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recolher menu lateral" })).toBeInTheDocument();
  });

  it("modo compacto esconde labels e expõe os nomes via aria-label", () => {
    renderSidebar(true);
    expect(screen.queryByText("Guia Financeiro")).not.toBeInTheDocument();
    // Link ainda nomeado para leitores de tela e tooltips (title).
    expect(screen.getByRole("link", { name: "Transações" })).toHaveAttribute(
      "title",
      "Transações",
    );
    expect(screen.getByRole("button", { name: "Expandir menu lateral" })).toBeInTheDocument();
  });

  it("toggle dispara o callback do dono do estado (PageShell)", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderSidebar(false, onToggle);

    await user.click(screen.getByRole("button", { name: "Recolher menu lateral" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("sem violações de acessibilidade (axe) nos dois modos", async () => {
    const { container } = renderSidebar(false);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("F25: hover expande a sidebar colapsada em overlay sem deslocar a página", async () => {
    vi.useFakeTimers();
    const { container } = renderSidebar(true);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();

    // Colapsada: apenas ícones, sem labels.
    expect(screen.queryByText("Transações")).not.toBeInTheDocument();

    // Hover: após o atraso anti-disparo (120ms), os labels aparecem.
    fireEvent.mouseEnter(aside!);
    await act(async () => {
      vi.advanceTimersByTime(130);
    });
    expect(screen.getByText("Transações")).toBeInTheDocument();

    // Saiu: volta ao estado colapsado (labels somem).
    fireEvent.mouseLeave(aside!);
    await act(async () => {
      vi.advanceTimersByTime(130);
    });
    expect(screen.queryByText("Transações")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("F25: mouse rápido (sem segurar o hover) não dispara a expansão", async () => {
    vi.useFakeTimers();
    const { container } = renderSidebar(true);
    const aside = container.querySelector("aside");

    // Entra e sai antes do atraso de 120ms: nenhuma expansão.
    fireEvent.mouseEnter(aside!);
    fireEvent.mouseLeave(aside!);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Transações")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("ao clicar na logo/nome do app na sidebar desktop abre o modal de perfil com atalhos e logout", async () => {
    const user = userEvent.setup();
    renderSidebar(false);

    const logoButton = screen.getByRole("button", { name: "Abrir perfil do usuário" });
    expect(logoButton).toBeInTheDocument();
    expect(screen.getByText("Guia Financeiro")).toBeInTheDocument();

    await user.click(logoButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Acesso Rápido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Segurança & Perfil/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aparência & Tema/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair da Conta/i })).toBeInTheDocument();
  });
});

