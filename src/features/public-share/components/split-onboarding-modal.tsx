import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  ExternalLink,
  MailCheck,
  Receipt,
  Smartphone,
  Sparkles,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  MoneyText,
  PasswordInput,
} from "@/components/ui";
import { signUpWithEmail, signInWithEmail } from "@/hooks/use-auth";
import { useSaveSplitExpense } from "@/state";
import { classifyError } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { formatDateBR } from "@/lib/date";
import { checkPasswordRequirements, normalizeEmail } from "@/domain/validation";

export interface SplitOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestShareCents: number;
  title: string;
  date: string;
  token: string;
  onSuccess?: () => void;
}

export function SplitOnboardingModal({
  open,
  onOpenChange,
  guestShareCents,
  title,
  date,
  token,
  onSuccess,
}: SplitOnboardingModalProps) {
  const navigate = useNavigate();
  const saveSplitMutation = useSaveSplitExpense();

  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleOpenInApp = () => {
    triggerSensory("action");
    const appDeepLink = `com.guiafinanceiro.app://r/${token}?action=save`;
    window.location.href = appDeepLink;
  };

  const handleModeChange = (newMode: "register" | "login") => {
    triggerSensory("selection");
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Informe um endereço de e-mail válido.");
      triggerSensory("destructive");
      return;
    }

    if (!password) {
      setError("Informe sua senha de acesso.");
      triggerSensory("destructive");
      return;
    }

    if (mode === "register") {
      const requirements = checkPasswordRequirements(password);
      if (!requirements.minLength) {
        setError("A senha deve conter ao menos 8 caracteres.");
        triggerSensory("destructive");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === "register") {
        const signupRes = await signUpWithEmail(cleanEmail, password, name.trim() || undefined);
        if (signupRes.needsEmailConfirmation) {
          triggerSensory("action");
          setConfirmationSent(true);
          try {
            localStorage.setItem(
              "axis_pending_split_expense",
              JSON.stringify({
                token,
                title,
                amountCents: guestShareCents,
                date,
              }),
            );
          } catch {
            // Ignora falhas de storage em ambiente restrito
          }
          return;
        }
      } else {
        await signInWithEmail(cleanEmail, password);
      }

      // Salva a transação inaugural no extrato da conta
      await saveSplitMutation.mutateAsync({
        title,
        amountCents: guestShareCents,
        date,
      });

      triggerSensory("success");
      onOpenChange(false);
      onSuccess?.();
      navigate("/");
    } catch (err) {
      triggerSensory("destructive");
      const classified = classifyError(err);
      setError(classified.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Salvar no meu controle financeiro"
      description="Inaugure seu painel no Áxis Finance com esta despesa já registrada."
      size="md"
    >
      {confirmationSent ? (
        <div className="py-4 space-y-4 text-center">
          <div className="mx-auto size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <MailCheck className="size-6 text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">
              Confirmação de e-mail enviada!
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Enviamos um link de ativação para{" "}
              <strong className="text-foreground font-semibold">{email}</strong>.
              Assim que você confirmar o acesso, sua despesa estará pronta e aguardando no seu painel financeiro.
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Entendido
          </Button>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Card Resumo da Despesa */}
          <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex items-center justify-between gap-3 shadow-2xs">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Receipt className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground truncate">
                  {title || "Racha de Despesa"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Data: {formatDateBR(date)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Sua parte
              </span>
              <div className="tabular-nums font-bold text-sm sm:text-base text-foreground">
                <MoneyText cents={guestShareCents} />
              </div>
            </div>
          </div>

          {/* Deep Link para Aplicativo Nativo Instalado */}
          <div className="rounded-xl border border-border/80 bg-background/50 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Smartphone className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  Já possui o app instalado?
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Abra no app nativo para salvar direto
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleOpenInApp}
              className="gap-1 shrink-0 border-border/80 bg-surface cursor-pointer"
              aria-label="Abrir despesa no aplicativo Áxis instalado"
            >
              <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Abrir no App</span>
            </Button>
          </div>

          {/* Seletor de Modo: Novo Visitante vs Já Tenho Conta */}
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                {mode === "register" ? "Auto-cadastro em 1 minuto" : "Acesse sua conta"}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => handleModeChange(mode === "register" ? "login" : "register")}
              className="h-auto p-0 text-xs text-primary hover:underline font-medium hover:bg-transparent cursor-pointer"
            >
              {mode === "register" ? "Já tenho conta" : "Criar nova conta"}
            </Button>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          {/* Formulário de Auto-Onboarding */}
          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            {mode === "register" && (
              <div className="space-y-1">
                <label
                  htmlFor="onboarding-name"
                  className="text-xs font-semibold text-foreground flex items-center justify-between"
                >
                  <span>Nome</span>
                  <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input
                  id="onboarding-name"
                  placeholder="Seu nome ou apelido"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div className="space-y-1">
              <label
                htmlFor="onboarding-email"
                className="text-xs font-semibold text-foreground"
              >
                E-mail
              </label>
              <Input
                id="onboarding-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="onboarding-password"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Senha</span>
                {mode === "register" && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    mínimo 8 caracteres
                  </span>
                )}
              </label>
              <PasswordInput
                id="onboarding-password"
                placeholder={mode === "register" ? "Crie uma senha de acesso" : "Sua senha"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {mode === "register" && (
              <div className="flex items-center gap-2">
                <Badge variant="muted" size="xs">
                  Plano Pro
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  30 dias de avaliação gratuita sem cartão.
                </span>
              </div>
            )}

            <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="w-full sm:w-auto cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isSubmitting}
                className="w-full sm:w-auto font-semibold cursor-pointer"
                sensoryIntent="success"
              >
                {isSubmitting
                  ? "Processando…"
                  : mode === "register"
                    ? "Criar Conta e Salvar Despesa"
                    : "Entrar e Salvar Despesa"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
