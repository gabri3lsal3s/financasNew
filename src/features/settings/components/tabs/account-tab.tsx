import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import {
  User,
  Mail,
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Calendar,
  Sparkles,
  ExternalLink,
  Loader2,
  LogOut,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  PasswordInput,
  Alert,
  Modal,
  ModalFooter,
} from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserAccess, useUserSubscription, useUpdateProfile } from "@/state";
import { updateUserPassword } from "@/data/auth";
import { checkPasswordRequirements } from "@/domain/validation";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";
import { DeleteAccountCard } from "./delete-account-card";

function formatAccountDate(dateString?: string | null): string {
  if (!dateString) return "Data indisponível";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getRoleLabel(role?: string): string {
  switch (role) {
    case "superadmin":
      return "Super Administrador";
    case "admin":
      return "Administrador";
    case "user":
    default:
      return "Membro";
  }
}

export function AccountTab() {
  const { user } = useAuth();
  const userAccess = useUserAccess();
  const subscription = useUserSubscription();
  const updateProfileMutation = useUpdateProfile();

  const profile = userAccess.profile;
  const currentName = profile?.name ?? user?.user_metadata?.name ?? "";
  const [name, setName] = useState(currentName);
  const [isNameDirty, setIsNameDirty] = useState(false);
  const [prevInitialName, setPrevInitialName] = useState(currentName);

  if (currentName !== prevInitialName) {
    setPrevInitialName(currentName);
    if (!isNameDirty) {
      setName(currentName);
    }
  }

  // Estado da troca de senha
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Estado do botão de cópia do ID
  const [copiedId, setCopiedId] = useState(false);

  // Estado da desconexão / encerramento de sessão
  const { signOut } = useSignOut();
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    triggerSensory("action");
    try {
      await signOut();
      pushToast({
        title: "Sessão encerrada",
        description: "Você foi desconectado com sucesso deste dispositivo.",
        variant: "default",
      });
    } catch (err) {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível sair",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      setIsSigningOut(false);
    }
  };

  const passwordRequirements = checkPasswordRequirements(newPassword);
  const isPasswordSufficient =
    passwordRequirements.minLength &&
    (passwordRequirements.hasUppercase || passwordRequirements.hasNumber);
  const isPasswordMatching = newPassword.length > 0 && newPassword === confirmPassword;
  const showPasswordMismatch = confirmPassword.length > 0 && !isPasswordMatching;

  const isNameChanged = name.trim().length > 0 && name.trim() !== currentName.trim();

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id || !isNameChanged) return;

    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        name: name.trim(),
      });
      setIsNameDirty(false);
    } catch {
      // O tratamento de erro e toast já são geridos pela mutation
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!isPasswordSufficient) {
      setPasswordError("A nova senha deve atender aos critérios de segurança mínimos.");
      return;
    }
    if (!isPasswordMatching) {
      setPasswordError("As senhas digitadas não coincidem.");
      return;
    }

    setPasswordError(null);
    setIsUpdatingPassword(true);
    try {
      await updateUserPassword(newPassword);
      triggerSensory("success");
      setNewPassword("");
      setConfirmPassword("");
      pushToast({
        title: "Senha atualizada",
        description: "Sua senha de acesso foi alterada com sucesso.",
        variant: "success",
      });
    } catch (err) {
      triggerSensory("destructive");
      setPasswordError(getErrorMessage(err));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleCopyAccountId = async () => {
    if (!user?.id) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(user.id);
        setCopiedId(true);
        triggerSensory("action");
        pushToast({
          title: "ID copiado",
          description: "Identificador da conta copiado para a área de transferência.",
          variant: "default",
        });
        setTimeout(() => setCopiedId(false), 2000);
      }
    } catch {
      pushToast({
        title: "Não foi possível copiar",
        description: "Copie o identificador manualmente.",
        variant: "destructive",
      });
    }
  };

  const accountCreatedAt = profile?.created_at ?? user?.created_at;

  return (
    <div className="space-y-6">
      {/* Card 1: Dados Pessoais */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Dados Pessoais</span>
            </span>
            <Badge variant="muted" size="xs" className="font-mono uppercase w-fit">
              {getRoleLabel(userAccess.role)}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Gerencie o seu nome de exibição e confira os dados da sua identidade de acesso.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label htmlFor="account-name" className="text-xs font-semibold text-foreground">
                  Nome completo
                </label>
                <Input
                  id="account-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setIsNameDirty(true);
                  }}
                  placeholder="Seu nome completo"
                  className="h-10 text-sm rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="account-email" className="text-xs font-semibold text-foreground">
                    Endereço de e-mail
                  </label>
                  <Badge variant="positive" size="xs" className="gap-1">
                    <Check className="size-3" aria-hidden="true" />
                    <span>Verificado</span>
                  </Badge>
                </div>
                <div className="relative">
                  <Input
                    id="account-email"
                    type="email"
                    readOnly
                    disabled
                    value={user?.email || ""}
                    className="h-10 text-sm rounded-xl pl-9 bg-muted/40 text-muted-foreground cursor-not-allowed select-all"
                  />
                  <Mail
                    className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={!isNameChanged || updateProfileMutation.isPending}
                className="h-9 px-4 text-xs font-semibold rounded-xl"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                    <span>Salvando…</span>
                  </>
                ) : (
                  <span>Salvar Alterações</span>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card 2: Segurança & Senha */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Segurança &amp; Senha</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Altere sua senha de acesso periodicamente para manter sua conta protegida.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {passwordError ? <Alert variant="error">{passwordError}</Alert> : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label htmlFor="account-new-password" className="text-xs font-semibold text-foreground">
                  Nova senha
                </label>
                <PasswordInput
                  id="account-new-password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Mínimo de 8 caracteres"
                  className="h-10 text-sm rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="account-confirm-password"
                  className="text-xs font-semibold text-foreground"
                >
                  Confirmar nova senha
                </label>
                <PasswordInput
                  id="account-confirm-password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Repita a nova senha"
                  className="h-10 text-sm rounded-xl"
                />
                {showPasswordMismatch && (
                  <span className="text-[11px] text-critical-strong block">
                    As senhas digitadas não coincidem.
                  </span>
                )}
              </div>
            </div>

            {newPassword.length > 0 && (
              <div className="rounded-xl bg-muted/20 border border-border/80 p-3 space-y-1.5">
                <span className="text-[11px] font-semibold text-foreground">
                  Critérios de segurança da senha:
                </span>
                <ul className="text-[11px] space-y-1 text-muted-foreground">
                  <li
                    className={
                      passwordRequirements.minLength ? "text-positive-strong font-medium" : ""
                    }
                  >
                    • Pelo menos 8 caracteres
                  </li>
                  <li
                    className={
                      passwordRequirements.hasUppercase || passwordRequirements.hasNumber
                        ? "text-positive-strong font-medium"
                        : ""
                    }
                  >
                    • Letras maiúsculas ou números
                  </li>
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={
                  isUpdatingPassword ||
                  !isPasswordSufficient ||
                  !isPasswordMatching ||
                  newPassword.length === 0
                }
                className="h-9 px-4 text-xs font-semibold rounded-xl"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                    <span>Atualizando…</span>
                  </>
                ) : (
                  <span>Atualizar Senha</span>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card 3: Informações da Conta & Assinatura */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Detalhes da Conta &amp; SaaS</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Informações cadastrais, identificador exclusivo e status do plano ativo.
          </p>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Bloco 1: Identificador Único */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col justify-between gap-2">
              <span className="text-xs text-muted-foreground">Identificador da Conta</span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-foreground truncate select-all">
                  {user?.id ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : "—"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAccountId}
                  title="Copiar ID da conta"
                  className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {copiedId ? (
                    <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>

            {/* Bloco 2: Data de Criação */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col justify-between gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Membro desde</span>
              </span>
              <span className="font-semibold text-xs text-foreground">
                {formatAccountDate(accountCreatedAt)}
              </span>
            </div>

            {/* Bloco 3: Plano SaaS Ativo */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-portfolio" aria-hidden="true" />
                  <span>Plano Ativo</span>
                </span>
                <Link
                  to="/configuracoes?aba=assinatura"
                  className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                >
                  <span>Gerenciar</span>
                  <ExternalLink className="size-2.5" aria-hidden="true" />
                </Link>
              </div>
              <div className="flex items-center gap-2">
                {subscription.isPro ? (
                  <Badge variant="default" size="xs">
                    Plano Pro Ativo
                  </Badge>
                ) : subscription.isTrial ? (
                  <Badge variant="warning" size="xs">
                    Trial Pro ({subscription.trialDaysRemaining ?? 0} dias)
                  </Badge>
                ) : (
                  <Badge variant="muted" size="xs">
                    Plano Básico
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Sessão & Desconexão */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Sessão &amp; Desconexão</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Encerre a sessão do aplicativo neste dispositivo com segurança. Seus dados permanecerão salvos na nuvem.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Sair da conta neste dispositivo
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Você precisará inserir suas credenciais de acesso para entrar novamente.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSignOutModalOpen(true)}
              className="h-9 px-4 text-xs font-semibold rounded-xl shrink-0 cursor-pointer gap-1.5"
            >
              <LogOut className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Sair da Conta</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Saída */}
      <Modal
        open={isSignOutModalOpen}
        onOpenChange={(open) => {
          if (!isSigningOut) setIsSignOutModalOpen(open);
        }}
        title="Encerrar Sessão"
        description="Tem certeza de que deseja sair da sua conta neste dispositivo?"
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ao sair, suas informações e lançamentos continuam seguros na sua conta da nuvem. Você poderá se autenticar novamente a qualquer momento com seu e-mail e senha.
          </p>
          <ModalFooter className="mt-4 pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSignOutModalOpen(false)}
              disabled={isSigningOut}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                void handleSignOut();
              }}
              disabled={isSigningOut}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer gap-1.5"
            >
              {isSigningOut ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>Saindo…</span>
                </>
              ) : (
                <>
                  <LogOut className="size-3.5" aria-hidden="true" />
                  <span>Confirmar Saída</span>
                </>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Card 5: Zona de Perigo / Exclusão de Conta */}
      <DeleteAccountCard
        title="Zona de Perigo"
        description="Ações irreversíveis que afetam permanentemente sua conta e histórico financeiro."
        actionTitle="Excluir conta permanentemente"
        actionDescription="Exclui todas as transações, cartões, metas, investimentos e desvincula seu e-mail do sistema."
      />
    </div>
  );
}
