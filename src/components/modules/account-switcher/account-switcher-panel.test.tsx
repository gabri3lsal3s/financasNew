import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AccountSummary } from "@/types/session-custody";
import type { TabSessionContext } from "@/services/session-context";
import { AccountSwitcherPanel } from "./account-switcher-panel";

function makeContext(overrides: Partial<TabSessionContext> = {}): TabSessionContext {
  return {
    status: "authenticated",
    contextId: "ctx-1",
    csrfToken: "csrf-1",
    generation: 2,
    revision: 1,
    environment: "production",
    mode: "personal",
    accountRef: "acc-1",
    displayName: "Ana Costa",
    expiresAt: Date.now() + 60_000,
    mfaFactorId: null,
    pendingRevocations: 0,
    ...overrides,
  };
}

function makeAccount(overrides: Partial<AccountSummary> = {}): AccountSummary {
  return {
    accountRef: "acc-1",
    displayName: "Ana Costa",
    maskedEmail: "an***@exemplo.com",
    mode: "personal",
    status: "active",
    generation: 2,
    lastActivityAt: Date.now(),
    hasLocalLock: false,
    ...overrides,
  };
}

describe("AccountSwitcherPanel", () => {
  it("renderiza estado neutro sem contas salvas e exibe apenas opção genérica de Portal administrativo", async () => {
    const user = userEvent.setup();
    const onAddAccount = vi.fn();
    const onOpenAdminPortal = vi.fn();

    render(
      <AccountSwitcherPanel
        context={makeContext({ status: "neutral", accountRef: null, displayName: null })}
        accounts={[
          makeAccount({
            accountRef: "acc-op",
            displayName: "Operador Secreto",
            maskedEmail: "op***@axir.app",
            mode: "operator",
          }),
        ]}
        onAddAccount={onAddAccount}
        onOpenAdminPortal={onOpenAdminPortal}
      />,
    );

    expect(screen.getByText("Nenhuma conta ativa nesta aba")).toBeInTheDocument();
    expect(screen.queryByText("Operador Secreto")).not.toBeInTheDocument();
    expect(screen.queryByText("op***@axir.app")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Entrar em uma conta/i }));
    expect(onAddAccount).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Portal administrativo/i }));
    expect(onOpenAdminPortal).toHaveBeenCalledTimes(1);
  });

  it("mascara e-mail e dispara a troca direta ao clicar em Alternar", async () => {
    const user = userEvent.setup();
    const onSwitchAccount = vi.fn();
    const acc1 = makeAccount({ accountRef: "acc-1", displayName: "Ana Costa", status: "active" });
    const acc2 = makeAccount({
      accountRef: "acc-2",
      displayName: "Bruno Lima",
      maskedEmail: "bruno.completo@exemplo.com",
      status: "remembered",
      generation: 5,
    });

    render(
      <AccountSwitcherPanel
        context={makeContext({ accountRef: "acc-1" })}
        accounts={[acc1, acc2]}
        onSwitchAccount={onSwitchAccount}
      />,
    );

    // Nunca exibir e-mail completo
    expect(screen.queryByText("bruno.completo@exemplo.com")).not.toBeInTheDocument();
    expect(screen.getByText("br***@exemplo.com")).toBeInTheDocument();

    // Clique direto dispara a troca sem confirmação intermediária
    await user.click(screen.getByRole("button", { name: /Alternar/i }));
    expect(onSwitchAccount).toHaveBeenCalledWith(acc2);
  });

  it("renderiza estado bloqueado sem permitir troca direta e aciona desbloqueio", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    const onSwitchAccount = vi.fn();

    render(
      <AccountSwitcherPanel
        context={makeContext({ status: "locked" })}
        accounts={[
          makeAccount({ accountRef: "acc-1", status: "active" }),
          makeAccount({ accountRef: "acc-2", displayName: "Bruno Lima", status: "remembered" }),
        ]}
        onUnlock={onUnlock}
        onSwitchAccount={onSwitchAccount}
      />,
    );

    expect(screen.getByText("Sessão bloqueada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Alternar/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Desbloquear sessão/i }));
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("renderiza estado efêmero sem opção de lembrar conta ao sair", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <AccountSwitcherPanel
        context={makeContext({ status: "authenticated", mode: "shared", displayName: "Sessão Compartilhada" })}
        accounts={[]}
        onLogout={onLogout}
      />,
    );

    expect(screen.getByText("Modo efêmero")).toBeInTheDocument();
    expect(screen.queryByText(/Lembrar esta conta/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Encerrar sessão efêmera/i }));
    expect(onLogout).toHaveBeenCalledWith({ remember: false });
  });

  it("confirma esquecimento de conta e respeita opt-in de lembrar ao sair", async () => {
    const user = userEvent.setup();
    const onForgetAccount = vi.fn();
    const onLogout = vi.fn();
    const acc1 = makeAccount({ accountRef: "acc-1", displayName: "Ana Costa", status: "active" });
    const acc2 = makeAccount({ accountRef: "acc-2", displayName: "Bruno Lima", status: "remembered" });

    render(
      <AccountSwitcherPanel
        context={makeContext({ accountRef: "acc-1" })}
        accounts={[acc1, acc2]}
        onForgetAccount={onForgetAccount}
        onLogout={onLogout}
      />,
    );

    // Esquecer conta abre ConfirmDialog
    await user.click(screen.getByRole("button", { name: "Esquecer conta Bruno Lima" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Esquecer conta neste dispositivo")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Esquecer conta" }));
    expect(onForgetAccount).toHaveBeenCalledWith(acc2);

    // Logout direto no card da conta ativa envia remember: false
    await user.click(screen.getByRole("button", { name: /Sair desta conta/i }));
    expect(onLogout).toHaveBeenCalledWith({ remember: false });
    expect(
      screen.queryByText("Manter esta conta salva para login rápido ao sair"),
    ).not.toBeInTheDocument();
  });

  it("exibe acesso rápido Entrar para conta remembered em estado neutro e Entrar novamente apenas para contas expiradas/revogadas", async () => {
    const user = userEvent.setup();
    const onSwitchAccount = vi.fn();
    const onReauthAccount = vi.fn();
    const remembered = makeAccount({
      accountRef: "acc-rem",
      displayName: "Bruno Lima",
      status: "remembered",
    });
    const revoked = makeAccount({
      accountRef: "acc-rev",
      displayName: "Carla Dias",
      status: "revoked",
    });

    render(
      <AccountSwitcherPanel
        context={makeContext({ status: "neutral", accountRef: null, displayName: null })}
        accounts={[remembered, revoked]}
        onSwitchAccount={onSwitchAccount}
        onReauthAccount={onReauthAccount}
      />,
    );

    const enterBtn = screen.getByRole("button", { name: "Entrar" });
    const reauthBtn = screen.getByRole("button", { name: /Entrar novamente/i });

    await user.click(enterBtn);
    expect(onSwitchAccount).toHaveBeenCalledWith(remembered);

    await user.click(reauthBtn);
    expect(onReauthAccount).toHaveBeenCalledWith(revoked);
  });

  it("suporta navegação por teclado (setas, Home, End e Enter) na lista de contas", async () => {
    const user = userEvent.setup();
    const onSwitchAccount = vi.fn();
    const acc1 = makeAccount({ accountRef: "acc-1", displayName: "Ana Costa", status: "active" });
    const acc2 = makeAccount({ accountRef: "acc-2", displayName: "Bruno Lima", status: "remembered" });
    const acc3 = makeAccount({
      accountRef: "acc-3",
      displayName: "Carla Dias",
      status: "requires_reauth",
    });

    render(
      <AccountSwitcherPanel
        context={makeContext({ accountRef: "acc-1" })}
        accounts={[acc1, acc2, acc3]}
        onSwitchAccount={onSwitchAccount}
        onReauthAccount={vi.fn()}
      />,
    );

    const switchBtn = screen.getByRole("button", { name: /Alternar/i });
    const reauthBtn = screen.getByRole("button", { name: /Entrar novamente/i });

    switchBtn.focus();
    expect(switchBtn).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(reauthBtn).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(switchBtn).toHaveFocus();

    await user.keyboard("{End}");
    expect(reauthBtn).toHaveFocus();

    await user.keyboard("{Home}");
    expect(switchBtn).toHaveFocus();

    // Enter aciona troca direta
    await user.keyboard("{Enter}");
    expect(onSwitchAccount).toHaveBeenCalledWith(acc2);
  });
});
