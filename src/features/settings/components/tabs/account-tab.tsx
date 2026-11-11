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
  Laptop,
  Smartphone,
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
import { useAuth, requestUserEmailChange } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserAccess, useUserSubscription, useUpdateProfile } from "@/state";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";
import { ChangePasswordModal } from "./change-password-modal";
import { MfaModal } from "../mfa-modal";

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

  // Modais de Credenciais
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Estado da alteração de e-mail
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);

  const handleRequestEmailChange = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedEmail = newEmail.trim();

    if (!trimmedEmail) {
      setEmailChangeError("Informe o novo endereço de e-mail.");
      return;
    }

    if (user?.email && trimmedEmail.toLowerCase() === user.email.toLowerCase()) {
      setEmailChangeError("O novo e-mail deve ser diferente do e-mail atual.");
      return;
    }

    if (!emailCurrentPassword) {
      setEmailChangeError("Informe sua senha atual.");
      return;
    }

    setEmailChangeError(null);
    setIsUpdatingEmail(true);

    try {
      await requestUserEmailChange(emailCurrentPassword, trimmedEmail);
      triggerSensory("success");
      setIsEmailModalOpen(false);
      setNewEmail("");
      setEmailCurrentPassword("");
      pushToast({
        title: "Confirmação enviada",
        description: "Enviamos um link de confirmação para o novo e-mail. Verifique sua caixa de entrada.",
        variant: "success",
      });
    } catch (err) {
      triggerSensory("destructive");
      setEmailChangeError(getErrorMessage(err));
    } finally {
      setIsUpdatingEmail(false);
    }
  };

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

  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    triggerSensory("action");
    try {
      await signOut({ scope: "others" });
      triggerSensory("success");
      pushToast({
        title: "Outros acessos encerrados",
        description: "Todas as sessões ativas em outros navegadores ou aparelhos foram desconectadas com sucesso.",
        variant: "success",
      });
    } catch (err) {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível encerrar outras sessões",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSigningOutOthers(false);
    }
  };

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
      {/* Card 1: Dados Pessoais & Credenciais de Acesso */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Dados Pessoais &amp; Acesso</span>
            </span>
            <Badge variant="muted" size="xs" className="font-mono uppercase w-fit">
              {getRoleLabel(userAccess.role)}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Gerencie seu nome de exibição, endereço de e-mail e credenciais de segurança da conta.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Formulário de Nome Completo */}
          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="account-name" className="text-xs font-semibold text-foreground">
                Nome completo
              </label>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
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
                  className="h-10 text-sm rounded-xl flex-1"
                />
                <Button
                  type="submit"
                  disabled={!isNameChanged || updateProfileMutation.isPending}
                  className="h-10 px-4 text-xs font-semibold rounded-xl shrink-0 cursor-pointer"
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
            </div>
          </form>

          {/* Seção de Credenciais de Acesso (E-mail e Senha em formato compacto com Modais) */}
          <div className="pt-3 border-t border-border/60 space-y-3">
            <span className="text-xs font-semibold text-foreground block">
              Credenciais de Autenticação
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Linha de E-mail */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="account-email" className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-default">
                    <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Endereço de e-mail</span>
                  </label>
                  <Badge variant="positive" size="xs" className="gap-1">
                    <Check className="size-3" aria-hidden="true" />
                    <span>Verificado</span>
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    id="account-email"
                    type="email"
                    readOnly
                    disabled
                    value={user?.email || ""}
                    className="text-xs font-medium text-foreground bg-transparent border-0 p-0 focus:outline-none truncate select-all flex-1 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setEmailChangeError(null);
                      setNewEmail("");
                      setEmailCurrentPassword("");
                      setIsEmailModalOpen(true);
                    }}
                    className="rounded-lg cursor-pointer shrink-0"
                  >
                    Alterar e-mail
                  </Button>
                </div>
              </div>

              {/* Linha de Senha */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Senha de acesso</span>
                  </span>
                  <Badge variant="muted" size="xs">
                    Protegida
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground tracking-widest">
                    ••••••••••••
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="rounded-lg cursor-pointer shrink-0"
                  >
                    Alterar senha
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Informações da Conta & SaaS */}
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
        <CardContent>
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
                  className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
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
                  to="/configuracoes?tab=subscription"
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

      {/* Card 3: Segurança de Acesso, Sessões & Conexões Ativas */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Segurança de Acesso &amp; Sessões</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Monitore dispositivos conectados, encerre outros acessos ativos e configure proteção em duas etapas (2FA).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Sessão Atual */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-muted-foreground">
                {typeof navigator !== "undefined" && /mobile|android|iphone/i.test(navigator.userAgent) ? (
                  <Smartphone className="size-4" aria-hidden="true" />
                ) : (
                  <Laptop className="size-4" aria-hidden="true" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Este Dispositivo
                  </span>
                  <Badge variant="positive" size="xs">
                    Sessão Ativa
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground block font-mono">
                  {typeof navigator !== "undefined"
                    ? navigator.userAgent.includes("Android")
                      ? "Aplicativo Android / Mobile"
                      : navigator.userAgent.includes("iPhone")
                        ? "Navegador iOS Safari"
                        : "Navegador Web / Desktop"
                    : "Terminal de Acesso"}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSignOutModalOpen(true)}
              className="h-8 px-3 text-xs font-semibold rounded-xl shrink-0 cursor-pointer gap-1.5 self-start sm:self-auto"
            >
              <LogOut className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Sair deste aparelho</span>
            </Button>
          </div>

          {/* Desconexão Remota de Outras Sessões */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Encerrar outras sessões ativas
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Desconecta imediatamente seu usuário em outros computadores, celulares ou navegadores conectados.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isSigningOutOthers}
              onClick={() => {
                void handleSignOutOthers();
              }}
              className="h-8 px-3 text-xs font-semibold rounded-xl shrink-0 cursor-pointer gap-1.5 self-start sm:self-auto"
            >
              {isSigningOutOthers ? (
                <>
                  <Loader2 className="size-3 animate-spin mr-1" aria-hidden="true" />
                  <span>Encerrando…</span>
                </>
              ) : (
                <>
                  <KeyRound className="size-3 text-muted-foreground" aria-hidden="true" />
                  <span>Desconectar outros aparelhos</span>
                </>
              )}
            </Button>
          </div>

          {/* Autenticação em Duas Etapas (2FA / MFA) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Verificação em Duas Etapas (2FA / TOTP)
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Exige um código numérico temporário de 6 dígitos do Google Authenticator ou 1Password no login.
              </span>
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => setIsMfaModalOpen(true)}
              className="h-8 px-3 text-xs font-semibold rounded-xl shrink-0 cursor-pointer gap-1.5 self-start sm:self-auto"
            >
              <ShieldCheck className="size-3" aria-hidden="true" />
              <span>Gerenciar 2FA</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Alteração de E-mail */}
      <Modal
        open={isEmailModalOpen}
        onOpenChange={(open) => {
          if (!isUpdatingEmail) {
            setIsEmailModalOpen(open);
            if (!open) {
              setNewEmail("");
              setEmailCurrentPassword("");
              setEmailChangeError(null);
            }
          }
        }}
        title="Alterar E-mail de Acesso"
        description="Atualize seu endereço de e-mail. Um link de confirmação será enviado para validação."
        size="md"
      >
        <form onSubmit={handleRequestEmailChange} className="space-y-4 pt-2">
          {emailChangeError && <Alert variant="error">{emailChangeError}</Alert>}

          <div className="rounded-xl bg-muted/20 border border-border/80 p-3.5 space-y-1.5">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Confirmação de Segurança</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Por motivos de segurança, enviaremos links de confirmação para validar a alteração. O novo e-mail só será efetivado após a confirmação.
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="modal-new-email" className="text-xs font-semibold text-foreground">
                Novo endereço de e-mail
              </label>
              <Input
                id="modal-new-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  if (emailChangeError) setEmailChangeError(null);
                }}
                placeholder="novo@exemplo.com"
                className="h-10 text-sm rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="modal-email-current-password"
                className="text-xs font-semibold text-foreground"
              >
                Senha atual
              </label>
              <PasswordInput
                id="modal-email-current-password"
                autoComplete="current-password"
                required
                value={emailCurrentPassword}
                onChange={(e) => {
                  setEmailCurrentPassword(e.target.value);
                  if (emailChangeError) setEmailChangeError(null);
                }}
                placeholder="Digite sua senha atual"
                className="h-10 text-sm rounded-xl"
              />
              <span className="text-[11px] text-muted-foreground block">
                Necessária para confirmar sua identidade antes da alteração.
              </span>
            </div>
          </div>

          <ModalFooter className="mt-4 pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              disabled={isUpdatingEmail}
              onClick={() => setIsEmailModalOpen(false)}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isUpdatingEmail || !newEmail.trim() || !emailCurrentPassword.trim()}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer gap-1.5"
            >
              {isUpdatingEmail ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Enviando…</span>
                </>
              ) : (
                <span>Confirmar</span>
              )}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal de Alteração de Senha */}
      <ChangePasswordModal
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
      />

      {/* Modal de Confirmação de Desconexão */}
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
              disabled={isSigningOut}
              onClick={() => setIsSignOutModalOpen(false)}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={isSigningOut}
              onClick={() => {
                void handleSignOut();
              }}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer gap-1.5"
            >
              {isSigningOut ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
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

      {/* Modal de Gestão de Autenticação em Duas Etapas (2FA / TOTP) */}
      <MfaModal
        open={isMfaModalOpen}
        onOpenChange={setIsMfaModalOpen}
      />
    </div>
  );
}
