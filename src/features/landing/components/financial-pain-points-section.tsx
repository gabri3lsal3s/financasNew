import { useState } from "react";
import {
  Briefcase,
  Camera,
  Coins,
  PieChart,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";
import { triggerSensory } from "@/services/sensory";
import { ScrollReveal } from "./scroll-reveal";
import { SharedFinancesShowcase } from "./shared-finances-showcase";
import { PainCashPreview } from "./pain-previews/pain-cash-preview";
import { PainCapturePreview } from "./pain-previews/pain-capture-preview";
import { PainDebtsPreview } from "./pain-previews/pain-debts-preview";
import { PainBusinessPreview } from "./pain-previews/pain-business-preview";
import { PainInvestPreview } from "./pain-previews/pain-invest-preview";

export type PainKey = "cash" | "capture" | "business" | "debts" | "shared" | "invest";

interface PainOption {
  key: PainKey;
  title: string;
  shortLabel: string;
  subtitle: string;
  icon: typeof Wallet;
}

const PAIN_OPTIONS: readonly PainOption[] = [
  {
    key: "cash",
    title: "O saldo do banco engana no meio do mês",
    shortLabel: "Saldo enganoso",
    subtitle: "Faturas e contas esquecidas comem o dinheiro antes do dia 30.",
    icon: Wallet,
  },
  {
    key: "capture",
    title: "Desisto de anotar gastos na segunda semana",
    shortLabel: "Captura com IA",
    subtitle: "Digitar tudo na mão cansa; deixe a IA ler cupons, Pix e faturas por você.",
    icon: Camera,
  },
  {
    key: "business",
    title: "Misturo o dinheiro da empresa com a conta pessoal",
    shortLabel: "PF & PJ",
    subtitle: "Não sei o lucro real do negócio, quanto reservar para o DAS nem o limite do MEI.",
    icon: Briefcase,
  },
  {
    key: "debts",
    title: "Perco a conta de parcelas, dívidas e recebíveis",
    shortLabel: "Parcelas & Dívidas",
    subtitle: "Não sei quanto já comprometi nos próximos meses ou quem me deve.",
    icon: Coins,
  },
  {
    key: "shared",
    title: "Dividir despesas com casal ou amigos dá trabalho",
    shortLabel: "Casal & Amigos",
    subtitle: "Viagem em grupo, contas da casa e cobrança no WhatsApp viram bagunça.",
    icon: Users,
  },
  {
    key: "invest",
    title: "Na hora de investir, não sei o que comprar nem o preço",
    shortLabel: "Onde aportar",
    subtitle: "Dinheiro parado na corretora sem clareza de meta ou preço teto.",
    icon: PieChart,
  },
];

export interface FinancialPainPointsSectionProps {
  activePain?: PainKey;
  onPainChange?: (pain: PainKey) => void;
  onExploreInvestments?: () => void;
}

export function FinancialPainPointsSection({
  activePain: controlledPain,
  onPainChange,
  onExploreInvestments,
}: FinancialPainPointsSectionProps) {
  const [internalPain, setInternalPain] = useState<PainKey>("cash");
  const activePain = controlledPain ?? internalPain;
  const { containerRef: pillsRef, dragScrollProps } =
    useHorizontalDragScroll<HTMLDivElement>(activePain);

  const selectPain = (pain: PainKey) => {
    triggerSensory("selection");
    setInternalPain(pain);
    onPainChange?.(pain);
  };

  return (
    <section id="dores" className="py-14 md:py-28 border-t border-border/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12 space-y-8 sm:space-y-12 min-w-0 w-full">
        <ScrollReveal className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary-strong">
            <Sparkles className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Na Prática</span>
          </div>
          <h2 className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Reconhece alguma dessas situações?
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground leading-relaxed">
            Escolha o cenário que mais acontece com você hoje e experimente ao vivo como o Axir
            resolve cada um com clareza.
          </p>
        </ScrollReveal>

        {/* Pills horizontais no mobile (< lg) — Regra 9 */}
        <div
          ref={pillsRef}
          {...dragScrollProps}
          className="flex lg:hidden w-full max-w-full min-w-0 items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x pb-1 select-none"
          role="tablist"
          aria-label="Cenários financeiros do dia a dia"
        >
          {PAIN_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = activePain === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => selectPain(option.key)}
                className={cn(
                  "shrink-0 flex-1 min-w-fit inline-flex items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer touch-pan-x",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary-strong font-semibold"
                    : "border-border/80 bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{option.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start min-w-0">
          {/* Lista vertical no desktop */}
          <div
            className="hidden lg:flex lg:col-span-5 flex-col gap-2.5"
            role="tablist"
            aria-label="Situações financeiras reais"
          >
            {PAIN_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = activePain === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => selectPain(option.key)}
                  className={cn(
                    "w-full text-left rounded-2xl border p-4 transition-all cursor-pointer flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary/50 bg-primary/5 shadow-xs"
                      : "border-border/80 bg-surface hover:bg-surface-hover/50",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 mt-0.5",
                      isSelected ? "text-primary-strong" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground leading-snug">
                      {option.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {option.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Palco Interativo */}
          <div key={activePain} className="lg:col-span-7 min-w-0 w-full animate-fade-slide-in">
            {activePain === "cash" ? <PainCashPreview /> : null}
            {activePain === "capture" ? <PainCapturePreview /> : null}
            {activePain === "business" ? <PainBusinessPreview /> : null}
            {activePain === "debts" ? <PainDebtsPreview /> : null}
            {activePain === "shared" ? <SharedFinancesShowcase /> : null}
            {activePain === "invest" ? (
              <PainInvestPreview onExploreDeep={onExploreInvestments} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
