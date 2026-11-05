import { Link } from "react-router";
import {
  ArrowRight,
  ExternalLink,
  PieChart,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge, buttonVariants, Card, CardTitle } from "@/components/ui";
import { ScrollReveal } from "./scroll-reveal";
import { cn } from "@/lib/utils";

interface ToolItem {
  id: string;
  title: string;
  badge: string;
  badgeVariant: "warning" | "portfolio" | "positive";
  description: string;
  highlights: string[];
  path: string;
  icon: React.ReactNode;
}

const TOOLS: ToolItem[] = [
  {
    id: "debts",
    title: "Simulador de Dívidas: Avalanche vs Bola de Neve",
    badge: "Quitação Estratégica",
    badgeVariant: "warning",
    description:
      "Descubra exatamente quantos meses e quanto dinheiro você economiza eliminando primeiro dívidas caras versus o ganho comportamental de quitar as menores.",
    highlights: [
      "Comparação lado a lado com economia real em R$",
      "Ordem passo a passo de liquidação de cada dívida",
      "Simulação de aceleração com aportes extras mensais",
    ],
    path: "/ferramentas/simulador-dividas",
    icon: <ShieldAlert className="size-5 text-warning-strong" aria-hidden="true" />,
  },
  {
    id: "rebalance",
    title: "Simulador de Rebalanceamento Inteligente",
    badge: "Carteira & Aportes",
    badgeVariant: "portfolio",
    description:
      "Calcule a distribuição precisa do seu próximo aporte para recalibrar sua carteira na direção da estratégia-alvo, sem vender ativos e sem IR indevido.",
    highlights: [
      "Modelos prontos: Dividendos, Global e Crescimento",
      "Gráfico Donut de alocação pós-aporte em tempo real",
      "Recomendação de quanto comprar em cada classe",
    ],
    path: "/ferramentas/rebalanceamento",
    icon: <PieChart className="size-5 text-portfolio" aria-hidden="true" />,
  },
  {
    id: "compound",
    title: "Simulador de Juros Compostos & FIRE",
    badge: "Longo Prazo & Independência",
    badgeVariant: "positive",
    description:
      "Projete a multiplicação exponencial do seu patrimônio com aportes mensais e descubra o ano exato em que a sua renda passiva cobrirá seu custo de vida.",
    highlights: [
      "Ponto de Inflexão (juros mensais superando aportes)",
      "Estimativa de ano de alcance do FIRE (Independência)",
      "Tabela completa de evolução patrimonial ano a ano",
    ],
    path: "/ferramentas/juros-compostos",
    icon: <TrendingUp className="size-5 text-positive-strong" aria-hidden="true" />,
  },
];

export function ToolsShowcase() {
  return (
    <section id="ferramentas" className="relative py-16 sm:py-24 border-t border-border/60 overflow-hidden">
      {/* Luz ambiente suave de fundo */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-primary/5 blur-[140px] -z-10"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 pb-12">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>Ferramentas Gratuitas e Abertas</span>
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                Simuladores Financeiros Baseados em Matemática
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Tome decisões patrimoniais com rigor técnico e sem achismos. Processamento 100% no seu navegador,
                com links compartilháveis (Stateful URLs) e custo zero de servidor.
              </p>
            </div>

            <Link
              to="/ferramentas"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "shrink-0 gap-2 border-border/80 self-start sm:self-auto rounded-xl",
              )}
            >
              <span>Explorar Hub de Ferramentas</span>
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>

        {/* Grid dos 3 Simuladores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TOOLS.map((tool, idx) => (
            <ScrollReveal key={tool.id} delay={idx * 100}>
              <Card className="flex flex-col justify-between h-full border-border/80 bg-surface shadow-xs hover:border-primary/40 hover:shadow-sm transition-all rounded-2xl p-5 sm:p-6 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-surface-hover/80 border border-border/60">
                      {tool.icon}
                    </span>
                    <Badge variant={tool.badgeVariant} size="xs">
                      {tool.badge}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {tool.title}
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                  </div>

                  <ul className="space-y-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                    {tool.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="size-1 rounded-full bg-primary mt-1.5 shrink-0" aria-hidden="true" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-4 border-t border-border/40">
                  <Link
                    to={tool.path}
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "w-full rounded-xl font-semibold gap-1.5 shadow-xs",
                    )}
                  >
                    <span>Abrir Simulador</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
