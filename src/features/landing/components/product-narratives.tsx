import { ClipboardList, Lightbulb, Target } from "lucide-react";
import { Card } from "@/components/ui";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";
import { CashAndCardsNarratives } from "./narratives/cash-and-cards-narratives";
import { PortfolioAndSharedNarratives } from "./narratives/portfolio-and-shared-narratives";
import { CaptureNarrative } from "./narratives/capture-narrative";

const SECONDARY_PILLARS = [
  {
    icon: Target,
    title: "Metas com aporte mensal",
    text: "Cada objetivo tem o aporte necessário e o progresso até a data-alvo.",
  },
  {
    icon: ClipboardList,
    title: "Relatórios de fechamento",
    text: "Resumo mensal, divisão patrimonial e relatório em layout A4.",
  },
  {
    icon: Lightbulb,
    title: "Insights do seu histórico",
    text: "Alertas de variação fora do padrão e de assinaturas recorrentes.",
  },
];

export function ProductNarratives() {
  return (
    <section id="recursos" className="py-14 md:py-32 border-t border-border/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12 space-y-16 md:space-y-36">
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary-strong dark:text-primary block">
            Engenharia Financeira com Clareza Absoluta
          </span>
          <h2 className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Cinco eixos coordenados para sustentação e expansão do seu patrimônio
          </h2>
          <p className="mt-4 sm:mt-5 text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed">
            Sem fórmulas frágeis de planilhas e sem relatórios opacos. Uma arquitetura concebida para
            fornecer estabilidade imediata de caixa, horizonte seguro de compromissos futuros,
            cooperação financeira sem atrito e disciplina matemática de investimentos.
          </p>
        </ScrollReveal>

        <CashAndCardsNarratives />
        <PortfolioAndSharedNarratives />
        <CaptureNarrative />

        <ScrollReveal delay={100}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {SECONDARY_PILLARS.map((item) => (
              <Card
                key={item.title}
                className="border-border/80 bg-surface shadow-xs p-3.5 sm:p-4 space-y-1.5 rounded-2xl"
              >
                <div className="flex items-center gap-2">
                  <item.icon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-xs sm:text-sm font-bold text-foreground">{item.title}</span>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {item.text}
                </p>
              </Card>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
