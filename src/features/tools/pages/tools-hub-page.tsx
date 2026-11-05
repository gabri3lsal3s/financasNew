import { useEffect } from "react";
import { Link } from "react-router";
import {
  ShieldAlert,
  PieChart,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Lock,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@/components/ui";
import { ToolsHeader } from "../components/tools-header";
import { ToolsFooterCta } from "../components/tools-footer-cta";

interface ToolCardInfo {
  path: string;
  badge: string;
  title: string;
  description: string;
  highlights: string[];
  icon: React.ReactNode;
}

const TOOLS_LIST: ToolCardInfo[] = [
  {
    path: "/ferramentas/simulador-dividas",
    badge: "Quitação Estratégica",
    title: "Simulador de Dívidas: Avalanche vs Bola de Neve",
    description:
      "Descubra exatamente quantos meses e quanto dinheiro você economiza eliminando primeiro dívidas caras (Avalanche) versus o ganho comportamental de quitar as menores (Bola de Neve).",
    highlights: [
      "Comparação lado a lado com economia em reais",
      "Ordem passo a passo de liquidação das dívidas",
      "Simulação de aceleração com aportes extras mensais",
    ],
    icon: <ShieldAlert className="size-6 text-warning-strong" aria-hidden="true" />,
  },
  {
    path: "/ferramentas/rebalanceamento",
    badge: "Carteira & Aportes",
    title: "Simulador de Rebalanceamento Inteligente",
    description:
      "Calcule a distribuição precisa do seu próximo aporte para recalibrar sua carteira de investimentos na direção da estratégia-alvo, sem vender ativos e sem pagar imposto indevido.",
    highlights: [
      "Modelos prontos: Dividendos, Global e Crescimento",
      "Gráfico de alocação Donut pós-aporte em tempo real",
      "Recomendação de quanto comprar em cada classe",
    ],
    icon: <PieChart className="size-6 text-portfolio" aria-hidden="true" />,
  },
  {
    path: "/ferramentas/juros-compostos",
    badge: "Longo Prazo & FIRE",
    title: "Simulador de Juros Compostos & Independência Financeira",
    description:
      "Projete a multiplicação exponencial do seu patrimônio com aportes mensais e descubra o ano exato em que a sua renda passiva cobrirá integralmente o seu custo de vida.",
    highlights: [
      "Ponto de Inflexão (juros mensais superando os aportes)",
      "Estimativa de ano de alcance do FIRE (Independência Financeira)",
      "Tabela completa de evolução patrimonial ano a ano",
    ],
    icon: <TrendingUp className="size-6 text-positive-strong" aria-hidden="true" />,
  },
];

export function ToolsHubPage() {
  useEffect(() => {
    document.title =
      "Simuladores e Ferramentas Financeiras Gratuitas — Áxis Finance";
  }, []);
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col justify-between">
      <ToolsHeader />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10 flex-1">
        {/* Hero Section */}
        <section className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface px-3 py-1 text-xs font-semibold text-muted-foreground shadow-xs">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            <span>Ferramentas Financeiras Abertas</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Simuladores Financeiros Gratuitos
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Ferramentas públicas para você tomar decisões patrimoniais baseadas em matemática e sem achismos.
            Processamento 100% no seu navegador com zero envio de dados a servidores.
          </p>
        </section>

        {/* Grid dos Simuladores */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TOOLS_LIST.map((tool) => (
            <Card
              key={tool.path}
              className="border-border/80 bg-surface shadow-xs flex flex-col justify-between hover:border-primary/50 transition-all group"
            >
              <CardHeader className="space-y-3 pb-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-surface-hover/80">{tool.icon}</div>
                  <Badge variant="muted" size="xs">
                    {tool.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                  {tool.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tool.description}
                </p>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2 border-t border-border/60 pt-3">
                  {tool.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-positive-strong shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>

                <Link to={tool.path} className="block pt-2">
                  <Button variant="default" size="sm" className="w-full gap-2 font-semibold shadow-xs">
                    <span>Acessar Simulador</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Garantia de Privacidade e Processamento Local */}
        <section className="rounded-2xl border border-border/80 bg-surface/50 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-1 sm:mt-0">
              <Lock className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                Privacidade Absoluta: Execução 100% no Cliente
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Nenhum dado numérico, saldo ou aporte inserido nestes simuladores é salvo em bancos de dados remotos.
                Todos os cálculos rodam de forma determinística e segura no motor JavaScript do seu próprio dispositivo.
              </p>
            </div>
          </div>
          <Badge variant="positive" size="sm" className="shrink-0 self-start sm:self-auto">
            Zero Telemetria Financeira
          </Badge>
        </section>
      </main>

      <ToolsFooterCta />
    </div>
  );
}
