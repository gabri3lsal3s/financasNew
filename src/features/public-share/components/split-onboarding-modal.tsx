import { useId } from "react";
import { ExternalLink, MailCheck, Receipt, Smartphone } from "lucide-react";
import { Button, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { buildAppDeepLink } from "@/services/native/app-links";
import { formatDateBR } from "@/lib/date";
import { SplitOnboardingForm } from "./split-onboarding-form";
import { useSplitOnboarding } from "./use-split-onboarding";

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
  const formId = useId();
  const state = useSplitOnboarding({
    guestShareCents,
    title,
    date,
    token,
    onOpenChange,
    onSuccess,
  });

  const handleOpenInApp = () => {
    window.location.href = buildAppDeepLink(`r/${token}?action=save`);
  };

  const footer = state.confirmationSent ? (
    <ModalFooter borderless>
      <Button type="button" variant="default" onClick={() => onOpenChange(false)}>
        Entendido
      </Button>
    </ModalFooter>
  ) : (
    <ModalFooter borderless>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={state.isSubmitting}>
        Cancelar
      </Button>
      <Button
        type="submit"
        form={formId}
        variant="default"
        sensoryIntent={false}
        disabled={state.isSubmitting}
        loading={state.isSubmitting}
        className="font-semibold"
      >
        {state.mode === "register" ? "Criar Conta e Salvar Despesa" : "Entrar e Salvar Despesa"}
      </Button>
    </ModalFooter>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Salvar no meu controle financeiro"
      description="Inaugure seu painel no Axir com esta despesa já registrada."
      size="md"
      footer={footer}
    >
      {state.confirmationSent ? (
        <div className="py-4 space-y-4 text-center">
          <div className="mx-auto size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <MailCheck className="size-6 text-primary-strong" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">Confirmação de e-mail enviada!</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Enviamos um link de ativação para{" "}
              <strong className="text-foreground font-semibold">{state.email}</strong>.
              Assim que você confirmar o acesso, sua despesa estará pronta e aguardando no seu painel financeiro.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Receipt className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground truncate">
                  {title || "Racha de Despesa"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Data: {formatDateBR(date)}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Sua parte
              </span>
              <MoneyText cents={guestShareCents} tone="default" className="font-bold text-sm sm:text-base" />
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-background/50 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Smartphone className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">Já possui o app instalado?</p>
                <p className="text-[11px] text-muted-foreground truncate">Abra no app nativo para salvar direto</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenInApp}
              className="gap-1 shrink-0 border-border/80 bg-surface"
              aria-label="Abrir despesa no aplicativo Axir instalado"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Abrir no App</span>
            </Button>
          </div>

          <SplitOnboardingForm
            formId={formId}
            mode={state.mode}
            onModeChange={state.handleModeChange}
            name={state.name}
            onNameChange={state.setName}
            email={state.email}
            onEmailChange={state.setEmail}
            password={state.password}
            onPasswordChange={state.setPassword}
            isSubmitting={state.isSubmitting}
            error={state.error}
            onSubmit={state.handleSubmit}
          />
        </div>
      )}
    </Modal>
  );
}
