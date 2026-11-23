import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  Compass,
  CreditCard,
  Landmark,
  PlusCircle,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button-variants";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { OnboardingGoalId } from "@/types";
import { CashCheckpointDialog } from "./cash-checkpoint-dialog";
import { DemoTrackSelectModal } from "./demo-track-select-modal";

export type OnboardingQuickTourTrack = "finances" | "shared_finances" | "investments";

type FocusKey = "cards" | "family" | "investments";

interface FocusOption {
  goal: FocusKey;
  label: string;
  tourTrack: OnboardingQuickTourTrack;
  icon: typeof Wallet;
}

const FOCUS_OPTIONS: readonly FocusOption[] = [
  { goal: "cards", label: "Dia a dia & Cartões", tourTrack: "finances", icon: Wallet },
  { goal: "family", label: "Família & Amigos", tourTrack: "shared_finances", icon: Users },
  { goal: "investments", label: "Investimentos & Metas", tourTrack: "investments", icon: TrendingUp },
];

function normalizeFocus(goal?: OnboardingGoalId | null): FocusKey {
  if (goal === "family") return "family";
  if (goal === "investments") return "investments";
  return "cards";
}

function firstNameOf(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

export interface VirginAccountHeroProps {
  userName?: string | null;
  selectedFocus?: OnboardingGoalId | null;
  onSelectFocus?: (goal: OnboardingGoalId) => void;
  onDismiss?: () => void;
  onCalibrate?: () => void;
  onOpenNewTransaction?: () => void;
  onOpenStatementImport?: () => void;
  onStartQuickTour?: (track: OnboardingQuickTourTrack) => void;
  onOpenDemo?: () => void;
  onOpenPreferences?: () => void;
  className?: string;
}

/**
 * VirginAccountHero — Assistente inline confortável e dispensável do primeiro acesso (Fase 1).
 * Recebe apenas dados e callbacks via props (Regra 4.5 — sem imports de data/state).
 */
export function VirginAccountHero({
  userName,
  selectedFocus,
  onSelectFocus,
  onDismiss,
  onCalibrate,
  onOpenNewTransaction,
  onOpenStatementImport,
  onStartQuickTour,
  onOpenDemo,
  onOpenPreferences,
  className,
}: VirginAccountHeroProps) {
  const navigate = useNavigate();
  const [localFocus, setLocalFocus] = useState<FocusKey>(() => normalizeFocus(selectedFocus));
  const [prevSelectedFocus, setPrevSelectedFocus] = useState<OnboardingGoalId | null | undefined>(
    selectedFocus,
  );
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [checkpointOpen, setCheckpointOpen] = useState(false);

  if (selectedFocus !== prevSelectedFocus) {
    setPrevSelectedFocus(selectedFocus);
    if (selectedFocus) {
      setLocalFocus(normalizeFocus(selectedFocus));
    }
  }

  const activeFocus = localFocus;
  const { containerRef: focusRef, dragScrollProps } =
    useHorizontalDragScroll<HTMLDivElement>(activeFocus);
  const activeFocusOption =
    FOCUS_OPTIONS.find((opt) => opt.goal === activeFocus) ?? FOCUS_OPTIONS[0]!;
  const firstName = firstNameOf(userName);

  const handleSelectFocus = (goal: FocusKey) => {
    triggerSensory("selection");
    setLocalFocus(goal);
    onSelectFocus?.(goal);
  };

  const handleOpenDemo = () => {
    if (onOpenDemo) onOpenDemo();
    else setDemoModalOpen(true);
  };

  const handleQuickTour = () => {
    if (onStartQuickTour) {
      onStartQuickTour(activeFocusOption.tourTrack);
    } else {
      handleOpenDemo();
    }
  };

  const calibrateCard = (
    <div
      key="card-calibrate"
      className={cn(
        "flex flex-col justify-between gap-4 rounded-xl border p-4 shadow-xs",
        activeFocus === "cards"
          ? "border-primary/25 bg-primary/5"
          : "border-border/80 bg-surface",
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Landmark
            className={cn(
              "size-4 shrink-0",
              activeFocus === "cards" ? "text-primary-strong" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          {activeFocus === "cards" ? (
            <Badge variant="default" size="xs">
              Recomendado
            </Badge>
          ) : null}
        </div>
        <h3 className="text-sm font-semibold text-foreground">Informar Saldo Inicial</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Defina o saldo real das suas contas bancárias para calcular quanto pode gastar com segurança desde hoje.
        </p>
      </div>

      {onCalibrate ? (
        <Button
          size="sm"
          variant={activeFocus === "cards" ? "default" : "outline"}
          onClick={onCalibrate}
          className="w-full text-xs font-semibold cursor-pointer"
        >
          Calibrar Saldo
        </Button>
      ) : onOpenStatementImport ? (
        <Button
          size="sm"
          variant={activeFocus === "cards" ? "default" : "outline"}
          onClick={onOpenStatementImport}
          className="w-full text-xs font-semibold cursor-pointer"
        >
          Importar Arquivo
        </Button>
      ) : (
        <Button
          size="sm"
          variant={activeFocus === "cards" ? "default" : "outline"}
          onClick={() => setCheckpointOpen(true)}
          className="w-full text-xs font-semibold cursor-pointer"
        >
          Calibrar Saldo
        </Button>
      )}
    </div>
  );

  const transactionCard = (
    <div
      key="card-transaction"
      className="flex flex-col justify-between gap-4 rounded-xl border border-border/80 bg-surface p-4 shadow-xs"
    >
      <div className="space-y-2">
        <PlusCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">Lançar Despesa ou Receita</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Registre uma movimentação rápida, cole um Pix ou divida uma conta em grupo sem atrito.
        </p>
      </div>

      {onOpenNewTransaction ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenNewTransaction}
          className="w-full text-xs font-medium cursor-pointer"
        >
          Fazer Lançamento
        </Button>
      ) : (
        <Link
          to="/transacoes?novo=transacao"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full text-xs font-medium")}
        >
          Fazer Lançamento
        </Link>
      )}
    </div>
  );

  const creditCard = (
    <div
      key="card-credit"
      className="flex flex-col justify-between gap-4 rounded-xl border border-border/80 bg-surface p-4 shadow-xs"
    >
      <div className="space-y-2">
        <CreditCard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">Adicionar Cartão de Crédito</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Monitore limites disponíveis, datas de fechamento, parcelas futuras e o melhor dia de compra.
        </p>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate("/cartoes")}
        className="w-full text-xs font-medium cursor-pointer"
      >
        Cadastrar Cartão
      </Button>
    </div>
  );

  const familyCard = (
    <div
      key="card-family"
      className="flex flex-col justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-xs"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Users className="size-4 shrink-0 text-primary-strong" aria-hidden="true" />
          <Badge variant="default" size="xs">
            Recomendado
          </Badge>
        </div>
        <h3 className="text-sm font-semibold text-foreground">Espaço Família ou Viagem</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Crie um orçamento conjunto com divisão justa de contas ou organize rateios e metas compartilhadas.
        </p>
      </div>

      <Button
        size="sm"
        variant="default"
        onClick={() => navigate("/familia")}
        className="w-full text-xs font-semibold cursor-pointer"
      >
        Abrir Espaço Família
      </Button>
    </div>
  );

  const investmentsCard = (
    <div
      key="card-investments"
      className="flex flex-col justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-xs"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <TrendingUp className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
          <Badge variant="default" size="xs">
            Recomendado
          </Badge>
        </div>
        <h3 className="text-sm font-semibold text-foreground">Cadastrar Primeiro Ativo</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configure suas metas de alocação, calcule preço teto e receba sugestões de aporte sem vender posições.
        </p>
      </div>

      <Button
        size="sm"
        variant="default"
        onClick={() => navigate("/investments?novo=ativo")}
        className="w-full text-xs font-semibold cursor-pointer"
      >
        Ir para Carteira
      </Button>
    </div>
  );

  const orderedCards =
    activeFocus === "family"
      ? [familyCard, calibrateCard, transactionCard]
      : activeFocus === "investments"
        ? [investmentsCard, calibrateCard, transactionCard]
        : [calibrateCard, transactionCard, creditCard];

  return (
    <>
      <div
        role="region"
        aria-label="Primeiros passos na sua conta"
        className={cn(
          "flex flex-col gap-5 rounded-2xl border border-border/80 bg-surface p-5 sm:p-7 shadow-xs",
          className,
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" size="xs">
                30 dias Pro grátis
              </Badge>
              <span className="text-xs text-muted-foreground">
                Todos os módulos liberados sem restrições
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {firstName
                ? `Olá, ${firstName} — bem-vindo ao seu centro financeiro`
                : "Bem-vindo ao seu novo centro financeiro"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Sua conta já vem com 11 categorias organizadas. Escolha seu foco inicial para priorizarmos os primeiros passos ou explore o painel livremente:
            </p>
          </div>

          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0 self-start cursor-pointer"
            >
              <span>Explorar sozinho</span>
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <div
          ref={focusRef}
          {...dragScrollProps}
          className="flex w-full max-w-full min-w-0 items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x pb-0.5 select-none"
          role="group"
          aria-label="Foco inicial opcional"
        >
          {FOCUS_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = activeFocus === option.goal;
            return (
              <button
                key={option.goal}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelectFocus(option.goal)}
                className={cn(
                  "shrink-0 flex-1 min-w-fit inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer touch-pan-x",
                  isSelected
                    ? "border-primary/40 bg-primary/10 text-primary-strong font-semibold"
                    : "border-border/80 bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">{orderedCards}</div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/80">
          <span className="text-xs text-muted-foreground text-center sm:text-left">
            Prefere ver como tudo funciona com dados de exemplo antes de começar?
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
            {onOpenPreferences ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenPreferences}
                className="gap-1.5 text-xs font-medium cursor-pointer"
              >
                <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Personalizar alertas e privacidade</span>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleQuickTour}
              className="gap-1.5 text-xs font-medium cursor-pointer"
            >
              <Compass className="size-3.5 text-primary-strong" aria-hidden="true" />
              <span>Fazer Tour Rápido (1 min)</span>
              <ArrowRight className="size-3" aria-hidden="true" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenDemo}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Ver todas as trilhas
            </Button>
          </div>
        </div>
      </div>

      {checkpointOpen ? (
        <CashCheckpointDialog
          open={checkpointOpen}
          onOpenChange={setCheckpointOpen}
          currentBalanceCents={0}
        />
      ) : null}

      <DemoTrackSelectModal open={demoModalOpen} onOpenChange={setDemoModalOpen} />
    </>
  );
}
