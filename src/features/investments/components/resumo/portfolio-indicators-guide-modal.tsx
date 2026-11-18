import type { ReactNode } from "react";
import { Activity, Briefcase, CircleDollarSign, Info, Landmark, TrendingUp } from "lucide-react";
import { Badge, Button, Modal, MoneyText } from "@/components/ui";
import type { PortfolioPerformanceSummary } from "@/domain/portfolio/resumo-metrics";

export interface PortfolioIndicatorsGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasMarcoZeroContribution?: boolean;
  onOpenInitialCostDialog: () => void;
  performance: PortfolioPerformanceSummary;
  twrAnnualizedRatePct?: number | null;
}

interface GuideEntry {
  key: string;
  icon: typeof Briefcase;
  title: string;
  subtitle: string;
  description: string;
  recommendedFor: string;
  badge: ReactNode;
}

export function PortfolioIndicatorsGuideModal({
  open,
  onOpenChange,
  hasMarcoZeroContribution,
  onOpenInitialCostDialog,
  performance,
  twrAnnualizedRatePct,
}: PortfolioIndicatorsGuideModalProps) {
  const entries: GuideEntry[] = [
    {
      key: "patrimony",
      icon: Briefcase,
      title: "1. Patrimônio Total & Retorno Contábil",
      subtitle: "Ganho Estático das Posições Ativas",
      description:
        "O valor de mercado sob custódia hoje somado ao caixa. Reflete o ganho estático das posições abertas frente ao custo de aquisição mais proventos ativos. Não considera o tempo decorrido nem ativos já encerrados.",
      recommendedFor: "Indicado para: Posições em custódia ativa",
      badge: (
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant={performance.totalReturnPnlBRL >= 0 ? "positive" : "negative"}
            size="xs"
            className="font-mono font-bold"
          >
            {performance.totalReturnPct !== null
              ? `${performance.totalReturnPct >= 0 ? "+" : ""}${performance.totalReturnPct.toFixed(1)}%`
              : "—"}
          </Badge>
          <span className="font-mono text-xs font-semibold text-foreground">
            (<MoneyText cents={performance.totalReturnCents} tone="auto" sign="explicit" />)
          </span>
        </div>
      ),
    },
    {
      key: "twr",
      icon: TrendingUp,
      title: "2. Rentabilidade da Carteira (TWR · Cotas)",
      subtitle: "Métrica Oficial da Carteira",
      description:
        "Apura o retorno real das suas decisões de investimento utilizando o método oficial de cotização de fundos. Isola o timing de aportes e resgates, mostrando o mérito da alocação e protegendo os lucros de ativos passados já encerrados na cota histórica.",
      recommendedFor: "Indicado para: Comparação com CDI e Ibovespa",
      badge: (
        <Badge
          variant={
            performance.twrTone === "positive"
              ? "positive"
              : performance.twrTone === "negative"
                ? "negative"
                : "muted"
          }
          size="xs"
          className="font-mono font-bold shrink-0"
        >
          {performance.twrLabel}
          {twrAnnualizedRatePct !== null && twrAnnualizedRatePct !== undefined
            ? ` (${twrAnnualizedRatePct >= 0 ? "+" : ""}${twrAnnualizedRatePct.toFixed(1)}% a.a.)`
            : ""}
        </Badge>
      ),
    },
    {
      key: "all-time",
      icon: CircleDollarSign,
      title: "3. Resultado Histórico (P&L Total em R$)",
      subtitle: "Riqueza Efetiva Produzida",
      description:
        "Consolida todo o lucro líquido gerado pela sua carteira desde o início. Soma o lucro realizado de ativos já vencidos/vendidos no passado, a valorização das posições abertas de hoje e todos os proventos recebidos na história.",
      recommendedFor: "Indicado para: Dimensão financeira total e caixa",
      badge: (
        <Badge
          variant={performance.allTimePnlBRL >= 0 ? "positive" : "negative"}
          size="xs"
          className="font-mono font-bold shrink-0"
        >
          <MoneyText
            cents={performance.allTimePnlCents}
            tone={performance.allTimePnlBRL >= 0 ? "positive" : "negative"}
            sign="explicit"
          />
        </Badge>
      ),
    },
    {
      key: "irr",
      icon: Activity,
      title: "4. Retorno do Bolso (TIR / XIRR)",
      subtitle: "Retorno do Seu Fluxo Pessoal",
      description:
        "Taxa anualizada (% a.a.) do dinheiro real que saiu da sua conta bancária para a corretora frente ao patrimônio atual. Pondera o volume pelo tempo: fases em que você tinha mais capital aplicado exercem peso proporcionalmente maior na taxa.",
      recommendedFor: "Indicado para: Eficiência do timing de aportes",
      badge: (
        <Badge
          variant={
            performance.irrTone === "positive"
              ? "positive"
              : performance.irrTone === "negative"
                ? "negative"
                : "muted"
          }
          size="xs"
          className="font-mono font-bold shrink-0"
        >
          {performance.irrLabel}
        </Badge>
      ),
    },
    {
      key: "benchmarks",
      icon: Landmark,
      title: "5. Comparação com Benchmarks e Referências de Mercado",
      subtitle: "Diretrizes de Comparabilidade e Disclaimers",
      description:
        "Para comparar sua carteira com CDI, Ibovespa ou fundos de mercado, utilize sempre o TWR (% a.a.), pois os indexadores são calculados por rentabilidade de cotas e não sofrem o impacto do fluxo de aportes e retiradas. A TIR (% a.a.) apura o retorno financeiro ponderado do seu fluxo de caixa pessoal, não sendo diretamente comparável a benchmarks passivos. Rentabilidade passada não representa garantia de retorno futuro.",
      recommendedFor: "Indicado para: Comparação justa e alinhamento metodológico",
      badge: (
        <Badge variant="muted" size="xs" className="font-mono font-bold shrink-0">
          CDI · Ibov · IPCA
        </Badge>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Modelos de Rentabilidade da Carteira"
      description="Entenda como cada método avalia seu patrimônio com transparência e sem armadilhas matemáticas."
      size="lg"
    >
      <div className="flex flex-col gap-3.5 text-xs mt-2">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Info className="size-4 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-0.5 text-[11px] leading-relaxed text-muted-foreground min-w-0">
              <span className="font-semibold text-foreground">
                Calibragem de Dados Anteriores ao App
              </span>
              <p>
                Se você investia antes de começar no app, cadastre seus Marcos Históricos ou importe
                seu extrato no assistente para que a TIR e o TWR considerem os aportes e lucros
                passados com precisão matemática.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant={hasMarcoZeroContribution ? "outline" : "default"}
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onOpenInitialCostDialog();
            }}
            className="gap-1.5 shrink-0 w-full sm:w-auto text-xs"
          >
            <span>
              {hasMarcoZeroContribution
                ? "Gerenciar Marcos Históricos"
                : "Cadastrar Marcos Históricos"}
            </span>
          </Button>
        </div>

        {entries.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="rounded-xl bg-surface-raised p-3.5 flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5 flex-wrap">
                <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 min-w-0">
                  <Icon className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.title}</span>
                </span>
                {item.badge}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                  {item.subtitle}
                </span>
                <p className="text-muted-foreground leading-relaxed m-0 text-xs">{item.description}</p>
              </div>
              <div className="pt-1.5 border-t border-border/50 flex items-center justify-between">
                <Badge variant="muted" size="xs">
                  {item.recommendedFor}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
