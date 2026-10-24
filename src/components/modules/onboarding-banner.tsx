import { useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  Check,
  ChevronRight,
  CreditCard,
  Receipt,
  Share2,
  Sparkles,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";
import { Button, Progress, ResponsiveDialog } from "@/components/ui";
import { coreOnboardingProgress, coreOnboardingSteps, onboardingSteps } from "@/domain/onboarding";
import type { OnboardingCounts, OnboardingStepId } from "@/domain/onboarding";
import { requestNotificationListenerPermission } from "@/services/native";
import { triggerSensory } from "@/services/sensory";
import { DemoTrackSelectModal } from "./demo-track-select-modal";
import { cn } from "@/lib/utils";

const STEP_META: Record<
  OnboardingStepId,
  { label: string; description: string; href?: string; icon: typeof Tag }
> = {
  "expense-category": {
    label: "Crie categorias de despesa",
    description: "Classifique seus gastos desde o início.",
    href: "/categorias?type=expense",
    icon: Tag,
  },
  "income-category": {
    label: "Crie categorias de renda",
    description: "Separe salário, freelas e outras entradas.",
    href: "/categorias?type=income",
    icon: TrendingUp,
  },
  card: {
    label: "Adicione um cartão de crédito",
    description: "Acompanhe faturas, pagamentos e limites.",
    href: "/cartoes",
    icon: CreditCard,
  },
  "first-transaction": {
    label: "Registre o primeiro lançamento",
    description: "Despesas e rendas alimentam os relatórios e insights.",
    href: "/transacoes?novo=transacao",
    icon: Receipt,
  },
  "bank-notifications": {
    label: "Ativar Leitor Automático de Notificações",
    description: "Captura de compras de cartão e Pix em segundo plano.",
    icon: Bell,
  },
};

// --- ChecklistContent --- usado dentro do modal responsivo
interface ChecklistContentProps {
  counts: OnboardingCounts;
  onEnableNotifications?: () => void | Promise<void>;
  onClose: () => void;
  onOpenDemoTrackSelect?: () => void;
}

function ChecklistContent({
  counts,
  onEnableNotifications,
  onClose,
  onOpenDemoTrackSelect,
}: ChecklistContentProps) {
  const steps = onboardingSteps(counts);

  const handleEnableNotifications = async () => {
    triggerSensory("action");
    if (onEnableNotifications) {
      await onEnableNotifications();
      return;
    }
    await requestNotificationListenerPermission();
  };

  const progress = coreOnboardingProgress(counts);

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de progresso dos passos principais */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {progress.done} de {progress.total} passos concluídos
          </span>
          {progress.done < progress.total && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onOpenDemoTrackSelect?.();
              }}
              className="gap-1.5 border-primary/40 hover:bg-primary/10 text-xs font-medium cursor-pointer h-7 px-2.5"
            >
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              <span>Explorar com Simulação</span>
            </Button>
          )}
        </div>
        <Progress
          value={(progress.done / progress.total) * 100}
          tone="auto"
          aria-label={`Progresso da configuração: ${progress.done} de ${progress.total}`}
        />
      </div>

      {/* Lista de passos */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {steps.map((step) => {
          const meta = STEP_META[step.id];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                step.done
                  ? "border-border/60 bg-surface-hover/20 text-muted-foreground"
                  : "border-border/80 bg-surface shadow-2xs hover:border-border",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                  step.done
                    ? "border-positive/20 bg-positive/10 text-positive-strong"
                    : "border-border/80 bg-surface-hover text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {step.done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-xs sm:text-sm font-semibold truncate",
                    step.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {meta.label}
                </p>
                {!step.done ? (
                  <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
                ) : null}
              </div>
              {!step.done ? (
                meta.href ? (
                  <Link to={meta.href} onClick={onClose}>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs font-medium cursor-pointer">
                      Configurar
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEnableNotifications}
                    className="h-7 px-2.5 text-xs font-medium cursor-pointer"
                  >
                    Configurar
                  </Button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Dica educativa de contingência */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface-hover/30 p-3 text-xs text-muted-foreground">
        <Share2 className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold text-foreground text-xs">
            Dica de contingência
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Seu banco não notificou uma transferência? Basta tocar em Compartilhar Comprovante para o Áxis Finance.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- OnboardingBanner --- banner slim exibido na home
export interface OnboardingBannerProps {
  counts: OnboardingCounts;
  onDismiss: () => void;
  onEnableNotifications?: () => void | Promise<void>;
  className?: string;
}

/**
 * Banner compacto de configuração inicial (§5.7).
 * Exibe uma faixa de ~44px com progresso e botão "Continuar" que abre
 * o checklist completo em um modal. O usuário pode dispensar com [X].
 * Desaparece automaticamente quando o usuário se torna ativo
 * (via shouldShowOnboardingBanner no overview-page).
 */
export function OnboardingBanner({ counts, onDismiss, onEnableNotifications, className }: OnboardingBannerProps) {
  const [open, setOpen] = useState(false);
  const [demoTrackModalOpen, setDemoTrackModalOpen] = useState(false);
  const progress = coreOnboardingProgress(counts);
  const pendingSteps = coreOnboardingSteps(counts).filter((s) => !s.done);

  const handleDismiss = () => {
    triggerSensory("action");
    onDismiss();
  };

  const handleOpen = () => {
    triggerSensory("action");
    setOpen(true);
  };

  return (
    <>
      {/* Banner slim */}
      <div
        role="region"
        aria-label="Configuração inicial da conta"
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-border/80 bg-surface px-4 py-2.5 shadow-xs transition-all hover:border-border",
          className,
        )}
      >
        {/* Ícone + texto */}
        <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

        <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground leading-none">
            Configure sua conta
          </span>
          <span className="num text-xs font-medium text-muted-foreground leading-none">
            {progress.done}/{progress.total}
          </span>
          {pendingSteps.length > 0 && (
            <span className="hidden sm:inline text-xs text-muted-foreground truncate">
              — {pendingSteps[0] ? (STEP_META[pendingSteps[0].id]?.label ?? "") : ""}
              {pendingSteps.length > 1 ? ` e mais ${pendingSteps.length - 1}` : ""}
            </span>
          )}
        </div>

        {/* Barra de progresso slim */}
        <div className="hidden sm:flex w-20 shrink-0">
          <Progress
            value={(progress.done / progress.total) * 100}
            tone="auto"
            aria-hidden="true"
            className="h-1.5"
          />
        </div>

        {/* Botão continuar */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpen}
          className="h-7 px-2.5 text-xs font-medium shrink-0 cursor-pointer gap-1"
        >
          Continuar
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>

        {/* Dismiss */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Dispensar aviso de configuração"
          title="Não mostrar novamente"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Modal com o checklist completo */}
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Configure sua conta"
        description="Complete os primeiros passos para aproveitar todos os recursos do app."
        size="lg"
      >
        <ChecklistContent
          counts={counts}
          onEnableNotifications={onEnableNotifications}
          onClose={() => setOpen(false)}
          onOpenDemoTrackSelect={() => setDemoTrackModalOpen(true)}
        />
      </ResponsiveDialog>

      {/* Modal seletor de trilha para simulação */}
      <DemoTrackSelectModal
        open={demoTrackModalOpen}
        onOpenChange={setDemoTrackModalOpen}
      />
    </>
  );
}
