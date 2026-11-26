import { useState } from "react";
import {
  Calculator,
  Cloud,
  Eye,
  EyeOff,
  FileSearch,
  PieChart,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

const TRUST_GUARANTEES = [
  {
    icon: ShieldCheck,
    iconClass: "text-positive-strong dark:text-positive",
    title: "Isolamento RLS & LGPD",
    subtitle: "Criptografia e zero senhas bancárias",
  },
  {
    icon: FileSearch,
    iconClass: "text-muted-foreground",
    title: "Memória de Cálculo",
    subtitle: "Cada número aberto passo a passo",
  },
  {
    icon: Cloud,
    iconClass: "text-warning-strong dark:text-warning",
    title: "100% Online First",
    subtitle: "Tudo sincronizado em tempo real",
  },
  {
    icon: Smartphone,
    iconClass: "text-portfolio",
    title: "Web, iPhone & Android Pro",
    subtitle: "Um único acesso em qualquer tela",
  },
];

export function HeroDashboardMockup() {
  const [privacyActive, setPrivacyActive] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  const maskClass = privacyActive
    ? "blur-xs select-none transition-all duration-200"
    : "transition-all duration-200";

  return (
    <>
      <ScrollReveal delay={120} direction="none" className="mt-10 sm:mt-16 max-w-6xl mx-auto">
        <div className="relative rounded-2xl sm:rounded-3xl border border-border/80 bg-surface p-4 sm:p-8 md:p-10 shadow-xl sm:shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 pb-3 sm:pb-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <BrandLogo markClassName="size-6" showWordmark wordmarkClassName="text-sm sm:text-base" />
              <Badge variant="default" size="xs" className="font-mono border border-primary/30 hidden sm:inline-flex">
                Painel interativo
              </Badge>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant={privacyActive ? "default" : "outline"}
                aria-pressed={privacyActive}
                onClick={() => {
                  triggerSensory("selection");
                  setPrivacyActive((prev) => !prev);
                }}
                className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
              >
                {privacyActive ? (
                  <EyeOff className="size-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="size-3.5" aria-hidden="true" />
                )}
                <span>{privacyActive ? "Escudo ativo" : "Escudo de Privacidade"}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant={showMemory ? "secondary" : "outline"}
                aria-expanded={showMemory}
                onClick={() => {
                  triggerSensory("selection");
                  setShowMemory((prev) => !prev);
                }}
                className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Calculator className="size-3.5" aria-hidden="true" />
                <span>Memória de cálculo</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            <div className="p-3.5 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl border border-primary/35 bg-surface-raised/60 shadow-xs flex flex-col justify-between min-w-0">
              <span className="text-xs sm:text-sm text-muted-foreground block line-clamp-2 break-words">
                Caixa Real Disponível
              </span>
              <div className={cn("my-1.5 sm:my-2", maskClass)}>
                <MoneyText
                  cents={624000}
                  tone="default"
                  deemphasizeCents={false}
                  className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-foreground"
                />
              </div>
              <span className="text-xs text-positive-strong dark:text-positive font-medium flex items-center gap-1.5">
                <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Livre de faturas e contas a vencer</span>
              </span>
            </div>

            <div className="p-3.5 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl border border-border/80 bg-surface-raised/50 flex flex-col justify-between min-w-0">
              <span className="text-xs sm:text-sm text-muted-foreground block line-clamp-2 break-words">
                Ritmo Diário
              </span>
              <div className={cn("my-1.5 sm:my-2 flex items-baseline gap-1.5 flex-wrap", maskClass)}>
                <MoneyText
                  cents={14800}
                  tone="default"
                  deemphasizeCents={false}
                  className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-primary-strong"
                />
                <span className="text-xs sm:text-sm font-mono font-normal text-muted-foreground">
                  / dia
                </span>
              </div>
              <span className="text-xs text-muted-foreground block">
                Para terminar o mês no azul
              </span>
            </div>

            <div className="p-3.5 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl border border-border/80 bg-surface-raised/50 flex flex-col justify-between min-w-0">
              <span className="text-xs sm:text-sm text-muted-foreground block line-clamp-2 break-words">
                Aporte Calibrado do Mês
              </span>
              <div className={cn("my-1.5 sm:my-2", maskClass)}>
                <MoneyText
                  cents={150000}
                  tone="portfolio"
                  deemphasizeCents={false}
                  className="text-xl sm:text-2xl lg:text-3xl font-extrabold"
                />
              </div>
              <span className="text-xs text-portfolio font-medium flex items-center gap-1.5">
                <PieChart className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Direcionado: Renda Fixa &amp; FIIs</span>
              </span>
            </div>
          </div>

          {showMemory ? (
            <div
              data-testid="hero-calculation-memory"
              className="mt-3.5 sm:mt-4 rounded-xl sm:rounded-2xl border border-primary/25 bg-primary/5 p-3.5 sm:p-4 animate-fade-slide-in"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-primary/15">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Calculator className="size-4 text-primary-strong" aria-hidden="true" />
                  <span>Memória de Cálculo · Caixa Real Disponível</span>
                </div>
                <Badge variant="default" size="xs">
                  Zero Caixa Preta
                </Badge>
              </div>
              <div className={cn("grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs", maskClass)}>
                <div className="rounded-lg border border-border/80 bg-surface px-3 py-2 flex items-center justify-between sm:flex-col sm:items-start gap-1">
                  <span className="text-muted-foreground">Saldo bancário</span>
                  <MoneyText cents={890000} tone="default" className="font-bold text-foreground" />
                </div>
                <div className="rounded-lg border border-border/80 bg-surface px-3 py-2 flex items-center justify-between sm:flex-col sm:items-start gap-1">
                  <span className="text-muted-foreground">(-) Faturas abertas</span>
                  <MoneyText cents={-248000} tone="negative" className="font-bold" />
                </div>
                <div className="rounded-lg border border-border/80 bg-surface px-3 py-2 flex items-center justify-between sm:flex-col sm:items-start gap-1">
                  <span className="text-muted-foreground">(-) Contas a vencer</span>
                  <MoneyText cents={-18000} tone="negative" className="font-bold" />
                </div>
                <div className="rounded-lg border border-primary/30 bg-surface px-3 py-2 flex items-center justify-between sm:flex-col sm:items-start gap-1">
                  <span className="font-semibold text-primary-strong">(=) Seguro hoje</span>
                  <MoneyText cents={624000} tone="positive" className="font-extrabold" />
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-3.5 sm:mt-6 rounded-xl sm:rounded-2xl border border-border/80 bg-surface-raised/40 p-3.5 sm:p-5 lg:p-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 text-xs sm:text-sm mb-2.5 sm:mb-3">
              <span className="font-semibold text-foreground">Orçamento Mensal Consolidado</span>
              <span
                className={cn(
                  "font-mono tabular-nums text-muted-foreground text-xs sm:text-sm",
                  maskClass,
                )}
              >
                R$ 3.820 de R$ 5.500 (69% utilizado · R$ 1.680 livres)
              </span>
            </div>
            <div className="w-full h-3 sm:h-4 rounded-full overflow-hidden bg-muted p-0.5 flex gap-1 border border-border/60">
              <div className="h-full rounded-full bg-cat-2 transition-all" style={{ width: "35%" }} />
              <div className="h-full rounded-full bg-cat-1 transition-all" style={{ width: "20%" }} />
              <div className="h-full rounded-full bg-cat-3 transition-all" style={{ width: "14%" }} />
            </div>
            <div className={cn("mt-3 sm:mt-4 flex flex-wrap gap-3 sm:gap-5 text-xs sm:text-sm text-muted-foreground", maskClass)}>
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <span className="size-2 sm:size-2.5 rounded-full bg-cat-2" /> Moradia (R$ 1.925)
              </span>
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <span className="size-2 sm:size-2.5 rounded-full bg-cat-1" /> Alimentação (R$ 1.100)
              </span>
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <span className="size-2 sm:size-2.5 rounded-full bg-cat-3" /> Transporte (R$ 770)
              </span>
            </div>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal
        delay={150}
        direction="none"
        className="mt-8 sm:mt-12 border-t border-border/70 pt-8 sm:pt-10"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 text-center">
          {TRUST_GUARANTEES.map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface border border-border/80 shadow-xs"
            >
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
                <item.icon className={`size-4 ${item.iconClass}`} aria-hidden="true" />
                <span>{item.title}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{item.subtitle}</span>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </>
  );
}
