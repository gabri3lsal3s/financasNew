import { useState, useRef } from "react";
import {
  PieChart,
  TrendingUp,
  FileSpreadsheet,
  Receipt,
  Scale,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  MoveHorizontal,
} from "lucide-react";
import { Badge, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "./spotlight-card";
import { ScrollReveal } from "./scroll-reveal";

export function InvestmentsShowcase() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth : 320;
    const gap = 16;
    const index = Math.round(el.scrollLeft / (cardWidth + gap));
    setActiveSlide(Math.min(5, Math.max(0, index)));
  };

  const scrollToCard = (index: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.children[index] as HTMLElement | undefined;
    if (card) {
      card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  return (
    <section id="investimentos" className="py-14 md:py-32 relative overflow-hidden scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-portfolio/30 bg-portfolio/10 px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-semibold text-portfolio">
            <TrendingUp className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Consultoria & Engenharia Patrimonial</span>
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Inteligência de Investimentos e Gestão Fiscal de Nível Bancário
          </h2>
          <p className="mt-4 sm:mt-5 text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed">
            Muito além de um simples rastreador de despesas: uma central avançada para blindar seu patrimônio,
            otimizar impostos e alocar cada centavo de aporte com precisão matemática.
          </p>
        </ScrollReveal>

        {/* Grid de Vitrine no Desktop / Carrossel Horizontal Deslizante com Snap no Mobile */}
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="mt-10 sm:mt-16 flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-4 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6"
        >
          {/* Card 1: Rebalanceamento Determinístico */}
          <ScrollReveal delay={0} className="h-full w-[85vw] max-w-[320px] shrink-0 snap-center sm:w-auto sm:max-w-none sm:shrink">
            <SpotlightCard
              spotlightColor="rgba(var(--portfolio), 0.16)"
              className="flex flex-col justify-between h-full"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-portfolio/10 text-portfolio">
                    <PieChart className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="portfolio" size="xs">
                    Algoritmo Puro
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground">
                  Motor de Rebalanceamento de Aportes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Defina suas metas ideais por classe e setor. Ao inserir o valor do aporte mensal, o motor calcula exatamente quanto direcionar para cada ativo defasado, sem necessidade de vender posições vencedoras.
                </p>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Alocação Atual / Meta</span>
                    <span className="font-semibold text-foreground">Renda Fixa: 22% / 30%</span>
                  </div>
                  <div className="mt-1 flex justify-between text-portfolio font-bold">
                    <span>Aporte Direcionado:</span>
                    <span>100% (R$ 2.400,00)</span>
                  </div>
                </div>
              </CardContent>
            </SpotlightCard>
          </ScrollReveal>

          {/* Card 2: Radar Fiscal de Renda Fixa */}
          <ScrollReveal delay={75} className="h-full w-[85vw] max-w-[320px] shrink-0 snap-center sm:w-auto sm:max-w-none sm:shrink">
            <SpotlightCard
              spotlightColor="rgba(var(--warning), 0.16)"
              className="flex flex-col justify-between h-full"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning-strong dark:text-warning">
                    <ShieldAlert className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="warning" size="xs">
                    Economia Tributária
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground">
                  Radar de Otimização Fiscal de IR
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Acompanhamento automático da tabela regressiva de Renda Fixa (22,5% a 15%). O sistema calcula a contagem regressiva e alerta o momento exato em que a alíquota cai antes de você resgatar.
                </p>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Alíquota Atual:</span>
                    <span className="font-semibold text-foreground">20.0%</span>
                  </div>
                  <div className="mt-1 flex justify-between text-positive-strong dark:text-positive font-semibold">
                    <span>Reduz para 17.5% em:</span>
                    <span>18 dias</span>
                  </div>
                </div>
              </CardContent>
            </SpotlightCard>
          </ScrollReveal>

          {/* Card 3: Monitor de Isenção DARF */}
          <ScrollReveal delay={150} className="h-full w-[85vw] max-w-[320px] shrink-0 snap-center sm:w-auto sm:max-w-none sm:shrink">
            <SpotlightCard
              spotlightColor="rgba(var(--positive), 0.16)"
              className="flex flex-col justify-between h-full"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-positive/10 text-positive-strong dark:text-positive">
                    <Receipt className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="positive" size="xs">
                    Conformidade Fiscal
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground">
                  Monitor e Apuração de DARF
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Monitoramento do limite mensal de isenção de R$ 20.000 em vendas de ações e apuração precisa de lucros/prejuízos tributáveis em FIIs e operações comuns para a declaração anual.
                </p>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Vendas no Mês:</span>
                    <span className="font-semibold text-foreground">R$ 11.450,00</span>
                  </div>
                  <div className="mt-1 flex justify-between text-positive-strong dark:text-positive font-semibold">
                    <span>Status da Isenção:</span>
                    <span>Isento (Dentro do limite)</span>
                  </div>
                </div>
              </CardContent>
            </SpotlightCard>
          </ScrollReveal>

          {/* Card 4: Dossiê e Caderno Excel Multi-Abas */}
          <ScrollReveal delay={0} className="h-full w-[85vw] max-w-[320px] shrink-0 snap-center sm:w-auto sm:max-w-none sm:shrink">
            <SpotlightCard
              spotlightColor="rgba(var(--primary), 0.16)"
              className="flex flex-col justify-between h-full"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileSpreadsheet className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="default" size="xs">
                    5 Abas Nativas
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground">
                  Dossiês & Exportação Excel (.xlsx)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Gere com 1 clique cadernos executivos completos em Excel com fórmulas dinâmicas: Resumo Patrimonial, Custódia de Ativos, Histórico de Proventos, DRE Pessoal e Dívidas.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-medium">
                    <CheckCircle2 className="size-3 text-positive-strong dark:text-positive" aria-hidden="true" />
                    DRE Mensal
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-medium">
                    <CheckCircle2 className="size-3 text-positive-strong dark:text-positive" aria-hidden="true" />
                    Custódia & Yield on Cost
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-medium">
                    <CheckCircle2 className="size-3 text-positive-strong dark:text-positive" aria-hidden="true" />
                    PDF Executivo
                  </span>
                </div>
              </CardContent>
            </SpotlightCard>
          </ScrollReveal>

          {/* Card 5: Balanço Patrimonial 360° */}
          <ScrollReveal delay={75} className="h-full w-[85vw] max-w-[320px] shrink-0 snap-center sm:w-auto sm:max-w-none sm:shrink">
            <SpotlightCard
              spotlightColor="rgba(var(--portfolio), 0.16)"
              className="flex flex-col justify-between h-full"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-portfolio/10 text-portfolio">
                    <Scale className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="portfolio" size="xs">
                    Visão Consolidada
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground">
                  Balanço Patrimonial Consolidado 360°
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Integração do fluxo de caixa com o valor de mercado da custódia, liquidez imediata e passivos/dívidas para apuração do Patrimônio Líquido Real em tempo real.
                </p>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Ativos Totais:</span>
                    <span className="font-semibold text-foreground">R$ 218.400,00</span>
                  </div>
                  <div className="mt-1 flex justify-between text-positive-strong dark:text-positive font-bold">
                    <span>Patrimônio Líquido:</span>
                    <span>R$ 194.250,00</span>
                  </div>
                </div>
              </CardContent>
            </SpotlightCard>
          </ScrollReveal>

          {/* Card 6: Painel de Proventos & Renda Passiva */}
          <ScrollReveal delay={150} className="h-full w-[85vw] max-w-[320px] shrink-0 snap-center sm:w-auto sm:max-w-none sm:shrink">
            <SpotlightCard
              spotlightColor="rgba(var(--positive), 0.16)"
              className="flex flex-col justify-between h-full"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-positive/10 text-positive-strong dark:text-positive">
                    <ArrowUpRight className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="positive" size="xs">
                    Yield on Cost
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground">
                  Índice de Liberdade por Dividendos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Acompanhe o percentual exato das suas despesas mensais essenciais que já são 100% pagas exclusivamente pela renda passiva dos seus dividendos e rendimentos.
                </p>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Proventos Mensais Médios:</span>
                    <span className="font-semibold text-foreground">R$ 1.840,00</span>
                  </div>
                  <div className="mt-1 flex justify-between text-positive-strong dark:text-positive font-bold">
                    <span>Cobertura de Contas Básicas:</span>
                    <span>54.2%</span>
                  </div>
                </div>
              </CardContent>
            </SpotlightCard>
          </ScrollReveal>
        </div>

        {/* Indicadores de Swipe (Dots de Paginação) e Dica Tátil no Mobile */}
        <div className="mt-3.5 flex flex-col items-center justify-center gap-2 sm:hidden">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Navegação dos 6 recursos">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToCard(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                  activeSlide === i ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
                aria-label={`Ir para recurso ${i + 1} de 6`}
                aria-selected={activeSlide === i}
                role="tab"
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden="true">
            <MoveHorizontal className="size-3.5" />
            <span>Deslize para ver os 6 recursos</span>
          </div>
        </div>
      </div>
    </section>
  );
}
