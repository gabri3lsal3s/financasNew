import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  ArrowLeftRight,
  Check,
  ExternalLink,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import type { AccountSummary } from "@/types/session-custody";
import type { TabSessionContext } from "@/services/session-context";
import { SESSION_POLICY, maskEmailForSwitcher } from "@/domain/auth/session-policy";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContentLoading } from "@/components/ui/content-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type AccountSwitcherBusyAction =
  | "list"
  | "switch"
  | "open-tab"
  | "logout"
  | "logout-device"
  | "forget"
  | null;

export interface AccountSwitcherPanelProps {
  context: TabSessionContext;
  accounts: AccountSummary[];
  loading?: boolean;
  busyAction?: AccountSwitcherBusyAction;
  error?: string | null;
  onRefresh?: () => void;
  onSwitchAccount?: (account: AccountSummary) => void | Promise<void>;
  onOpenTab?: (account: AccountSummary) => void | Promise<void>;
  onAddAccount?: () => void;
  onReauthAccount?: (account: AccountSummary) => void;
  onLogout?: (options: { remember: boolean }) => void | Promise<void>;
  onLogoutDevice?: () => void | Promise<void>;
  onForgetAccount?: (account: AccountSummary) => void | Promise<void>;
  onUnlock?: () => void;
  onOpenAdminPortal?: () => void;
  onClearError?: () => void;
  className?: string;
}

const MASKED_EMAIL_PATTERN = /^[^@\s]{1,2}\*{2,}@[^@\s]+$/;

function formatSafeMaskedEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (MASKED_EMAIL_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return maskEmailForSwitcher(trimmed);
}

function getAccountStatusBadge(status: AccountSummary["status"]): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case "active":
      return { label: "Ativa", variant: "positive" };
    case "remembered":
      return { label: "Lembrada", variant: "muted" };
    case "trust_expired":
      return { label: "Confiança expirada", variant: "warning" };
    case "requires_reauth":
      return { label: "Reautenticar", variant: "warning" };
    case "revoked":
      return { label: "Revogada", variant: "critical" };
  }
}

function requiresFreshLogin(status: AccountSummary["status"]): boolean {
  return status === "trust_expired" || status === "revoked" || status === "requires_reauth";
}

/**
 * Painel do alternador multiconta (T06).
 * Regras de segurança: nunca exibe e-mail completo, valores monetários ou identidade
 * de operador na tela inicial (exibe apenas opção genérica de Portal administrativo).
 */
export function AccountSwitcherPanel({
  context,
  accounts,
  loading = false,
  busyAction = null,
  error = null,
  onRefresh,
  onSwitchAccount,
  onOpenTab,
  onAddAccount,
  onReauthAccount,
  onLogout,
  onLogoutDevice,
  onForgetAccount,
  onUnlock,
  onOpenAdminPortal,
  onClearError,
  className,
}: AccountSwitcherPanelProps) {
  const [rememberOnLogout, setRememberOnLogout] = useState(false);
  const [switchingAccountRef, setSwitchingAccountRef] = useState<string | null>(null);
  const [pendingForgetAccount, setPendingForgetAccount] = useState<AccountSummary | null>(null);
  const [confirmLogoutDeviceOpen, setConfirmLogoutDeviceOpen] = useState(false);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Nunca expor identidades de operador na tela inicial do alternador.
  const visibleAccounts = accounts.filter((account) => account.mode !== "operator");
  const personalAccountsCount = visibleAccounts.filter((account) => account.mode === "personal").length;
  const limitReached = personalAccountsCount >= SESSION_POLICY.MAX_PERSONAL_ACCOUNTS;
  const isBusy = busyAction !== null;

  const isLocked = context.status === "locked" || context.status === "mfa_required";
  const isNeutral =
    context.status === "neutral" || context.status === "revoked" || context.status === "expired";
  const isEphemeral = context.status === "authenticated" && context.mode === "shared";
  const isPersonal = context.status === "authenticated" && context.mode !== "shared";

  const handleListKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      const focusable = itemRefs.current.filter((node): node is HTMLButtonElement => node !== null && !node.disabled);
      if (focusable.length === 0) return;

      const currentIndex = focusable.findIndex((node) => node === document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % focusable.length : 0;
        focusable[nextIndex]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prevIndex =
          currentIndex >= 0 ? (currentIndex - 1 + focusable.length) % focusable.length : focusable.length - 1;
        focusable[prevIndex]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        focusable[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        focusable[focusable.length - 1]?.focus();
      }
    },
    [],
  );

  const handleDirectSwitch = async (account: AccountSummary) => {
    setSwitchingAccountRef(account.accountRef);
    try {
      await onSwitchAccount?.(account);
    } finally {
      setSwitchingAccountRef((current) => (current === account.accountRef ? null : current));
    }
  };

  const handleConfirmForget = async () => {
    if (!pendingForgetAccount) return;
    const target = pendingForgetAccount;
    setPendingForgetAccount(null);
    await onForgetAccount?.(target);
  };

  const handleConfirmLogoutDevice = async () => {
    setConfirmLogoutDeviceOpen(false);
    await onLogoutDevice?.();
  };

  const renderAdminPortalFooter = () => {
    if (!onOpenAdminPortal) return null;
    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border/80 pt-3">
        <span className="text-xs text-muted-foreground">
          Acesso restrito a operadores em endereço isolado.
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isBusy}
          onClick={onOpenAdminPortal}
        >
          <Shield className="size-4 shrink-0" aria-hidden="true" />
          <span>Portal administrativo</span>
        </Button>
      </div>
    );
  };

  if (loading && visibleAccounts.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <ContentLoading />
        {renderAdminPortalFooter()}
      </div>
    );
  }

  return (
    <section
      aria-label="Alternador de contas"
      className={cn("space-y-4", className)}
    >
      {error ? (
        <Alert variant="error" className="items-center">
          <div className="flex w-full items-center justify-between gap-3">
            <span className="min-w-0 flex-1 leading-snug">{error}</span>
            {onClearError ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={onClearError}
              >
                Fechar
              </Button>
            ) : null}
          </div>
        </Alert>
      ) : null}

      {isLocked ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Lock className="size-4 shrink-0 text-warning-strong" aria-hidden="true" />
              <h3 className="font-display text-sm font-bold text-foreground">
                {context.status === "mfa_required" ? "Verificação em duas etapas pendente" : "Sessão bloqueada"}
              </h3>
            </div>
            <Badge variant="warning" size="sm">
              {context.status === "mfa_required" ? "MFA pendente" : "Bloqueada"}
            </Badge>
          </div>
          <Alert variant="warning">
            Desbloqueie esta sessão para visualizar ou alternar entre contas. A troca direta fica bloqueada até a confirmação.
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={isBusy} onClick={onUnlock}>
              <KeyRound className="size-4 shrink-0" aria-hidden="true" />
              <span>Desbloquear sessão</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={busyAction === "logout"}
              disabled={isBusy}
              onClick={() => void onLogout?.({ remember: false })}
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span>Sair desta conta</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              className="text-critical-strong hover:bg-critical/10 hover:text-critical-strong"
              onClick={() => setConfirmLogoutDeviceOpen(true)}
            >
              <span>Sair de todas as contas deste dispositivo</span>
            </Button>
          </div>
        </div>
      ) : null}

      {isEphemeral ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <h3 className="font-display text-sm font-bold text-foreground">
                {context.displayName ?? "Sessão temporária"}
              </h3>
            </div>
            <Badge variant="warning" size="sm">
              Modo efêmero
            </Badge>
          </div>
          <Alert variant="warning">
            Esta sessão está em dispositivo compartilhado. A conta não será lembrada ao sair e o acesso expira automaticamente por inatividade.
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              loading={busyAction === "logout"}
              disabled={isBusy}
              onClick={() => void onLogout?.({ remember: false })}
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span>Encerrar sessão efêmera</span>
            </Button>
          </div>
        </div>
      ) : null}

      {isNeutral ? (
        <div className="space-y-3">
          {context.status === "revoked" ? (
            <Alert variant="warning">
              A sessão anterior foi encerrada ou revogada. Escolha uma conta abaixo ou faça login novamente.
            </Alert>
          ) : context.status === "expired" ? (
            <Alert variant="warning">
              A sessão expirou por segurança. Faça login novamente para continuar.
            </Alert>
          ) : null}

          {visibleAccounts.length === 0 ? (
            <EmptyState
              tone="default"
              icon={<Users className="size-6" aria-hidden="true" />}
              title="Nenhuma conta ativa nesta aba"
              description="Entre em uma conta pessoal para retomar o acesso com isolamento de sessão."
              action={
                <Button type="button" size="sm" disabled={isBusy} onClick={onAddAccount}>
                  <Plus className="size-4 shrink-0" aria-hidden="true" />
                  <span>Entrar em uma conta</span>
                </Button>
              }
            />
          ) : (
            <div className="space-y-2 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Nenhuma conta ativa nesta aba
                  </h3>
                </div>
                <Badge variant="muted" size="sm">
                  Estado neutro
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione uma conta lembrada para entrar novamente ou adicione outro acesso.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {isPersonal || (isNeutral && visibleAccounts.length > 0) ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <h3 className="font-display text-sm font-bold text-foreground">
                Contas neste dispositivo
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="muted" size="sm">
                {personalAccountsCount} de {SESSION_POLICY.MAX_PERSONAL_ACCOUNTS} contas
              </Badge>
              {onRefresh ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 !w-8 !min-w-8 p-0 shrink-0"
                  aria-label="Atualizar lista de contas"
                  title="Atualizar lista de contas"
                  disabled={isBusy}
                  onClick={onRefresh}
                >
                  <RefreshCw className={cn("size-4", busyAction === "list" && "animate-spin")} aria-hidden="true" />
                  <span className="sr-only">Atualizar lista de contas</span>
                </Button>
              ) : null}
            </div>
          </div>

          {visibleAccounts.length > 0 ? (
            <ul
              aria-label="Lista de contas disponíveis"
              className="space-y-2"
              onKeyDown={handleListKeyDown}
            >
              {visibleAccounts.map((account, index) => {
                const isCurrent =
                  context.status === "authenticated" && context.accountRef === account.accountRef;
                const safeMaskedEmail = formatSafeMaskedEmail(account.maskedEmail);
                const statusBadge = getAccountStatusBadge(account.status);
                const needsLogin = requiresFreshLogin(account.status);
                const isSwitchingThis =
                  busyAction === "switch" && switchingAccountRef === account.accountRef;

                return (
                  <li
                    key={account.accountRef}
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      isCurrent
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/80 bg-surface",
                    )}
                  >
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground break-words">
                            {account.displayName}
                          </span>
                          <Badge variant={statusBadge.variant} size="sm">
                            {statusBadge.label}
                          </Badge>
                          {account.hasLocalLock ? (
                            <Badge variant="warning" size="sm">
                              Trava local
                            </Badge>
                          ) : null}
                        </div>
                        {safeMaskedEmail ? (
                          <p className="text-xs text-muted-foreground">{safeMaskedEmail}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {isCurrent ? (
                          <Badge variant="positive" size="sm">
                            <Check className="size-3" aria-hidden="true" />
                            <span>Nesta aba</span>
                          </Badge>
                        ) : needsLogin ? (
                          <Button
                            ref={(node) => {
                              itemRefs.current[index] = node;
                            }}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-initial"
                            disabled={isBusy}
                            onClick={() => onReauthAccount?.(account)}
                          >
                            <KeyRound className="size-3.5 shrink-0" aria-hidden="true" />
                            <span>Entrar novamente</span>
                          </Button>
                        ) : (
                          <Button
                            ref={(node) => {
                              itemRefs.current[index] = node;
                            }}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-initial"
                            loading={isSwitchingThis}
                            disabled={isBusy}
                            onClick={() => void handleDirectSwitch(account)}
                          >
                            <ArrowLeftRight className="size-3.5 shrink-0" aria-hidden="true" />
                            <span>{isNeutral ? "Entrar" : "Alternar"}</span>
                          </Button>
                        )}

                        {!needsLogin && account.status !== "remembered" && onOpenTab ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="size-8 !w-8 !min-w-8 p-0 shrink-0"
                            aria-label={`Abrir ${account.displayName} em nova aba`}
                            title="Abrir em nova aba"
                            disabled={isBusy}
                            onClick={() => void onOpenTab(account)}
                          >
                            <ExternalLink className="size-4" aria-hidden="true" />
                            <span className="sr-only">Abrir em nova aba</span>
                          </Button>
                        ) : null}

                        {onForgetAccount ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="size-8 !w-8 !min-w-8 p-0 shrink-0 text-critical-strong hover:bg-critical/10 hover:text-critical-strong"
                            aria-label={`Esquecer conta ${account.displayName}`}
                            title="Esquecer conta"
                            disabled={isBusy}
                            onClick={() => setPendingForgetAccount(account)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            <span className="sr-only">Esquecer conta</span>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma outra conta salva neste dispositivo.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between border-t border-border/80 pt-3">
            {limitReached ? (
              <span className="text-xs text-muted-foreground">
                Limite de {SESSION_POLICY.MAX_PERSONAL_ACCOUNTS} contas pessoais atingido.
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Adicione até {SESSION_POLICY.MAX_PERSONAL_ACCOUNTS} contas pessoais neste dispositivo.
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={isBusy || limitReached}
              onClick={onAddAccount}
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              <span>Adicionar conta</span>
            </Button>
          </div>
        </div>
      ) : null}

      {isPersonal ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <Checkbox
            checked={rememberOnLogout}
            onCheckedChange={setRememberOnLogout}
            disabled={isBusy}
            label="Manter esta conta salva para login rápido ao sair"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              loading={busyAction === "logout"}
              disabled={isBusy}
              onClick={() => void onLogout?.({ remember: rememberOnLogout })}
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span>Sair desta conta</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              className="w-full sm:w-auto text-critical-strong hover:bg-critical/10 hover:text-critical-strong"
              onClick={() => setConfirmLogoutDeviceOpen(true)}
            >
              <span>Sair de todas as contas deste dispositivo</span>
            </Button>
          </div>
        </div>
      ) : null}

      {renderAdminPortalFooter()}

      <ConfirmDialog
        open={pendingForgetAccount !== null}
        onOpenChange={(open) => {
          if (!open) setPendingForgetAccount(null);
        }}
        title="Esquecer conta neste dispositivo"
        description={
          pendingForgetAccount
            ? `Remover ${pendingForgetAccount.displayName} deste dispositivo revoga o acesso local e apaga os metadados salvos desta conta.`
            : undefined
        }
        confirmLabel="Esquecer conta"
        cancelLabel="Cancelar"
        variant="destructive"
        confirmPending={busyAction === "forget"}
        elevated
        onConfirm={() => void handleConfirmForget()}
      />

      <ConfirmDialog
        open={confirmLogoutDeviceOpen}
        onOpenChange={setConfirmLogoutDeviceOpen}
        title="Sair de todas as contas deste dispositivo"
        description="Esta ação encerra todas as sessões ativas e lembradas apenas neste dispositivo. Outros aparelhos conectados não serão alterados."
        confirmLabel="Sair deste dispositivo"
        cancelLabel="Cancelar"
        variant="destructive"
        confirmPending={busyAction === "logout-device"}
        elevated
        onConfirm={() => void handleConfirmLogoutDevice()}
      />
    </section>
  );
}
