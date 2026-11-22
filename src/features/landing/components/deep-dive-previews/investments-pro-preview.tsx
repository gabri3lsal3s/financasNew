import {
  ArrowUpRight,
  FileSpreadsheet,
  Globe,
  Landmark,
  Layers,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge, Card, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ValuationInteractivePreview } from "./valuation-interactive-preview";

interface AssetTargetRow {
  ticker: string;
  targetPct: string;
  actualPct: string;
  deviationPct: string;
  suggestedCents: number;
}

interface ClassTargetNode {
  name: string;
  targetPct: string;
  actualPct: string;
  deviationPct: string;
  barWidth: string;
  barColor: string;
  assets: readonly AssetTargetRow[];
}

const ALLOCATION_TREE: readonly ClassTargetNode[] = [
  {
    name: "Renda Fixa & Liquidez",
    targetPct: "35%",
    actualPct: "25%",
    deviationPct: "-10,0 p.p.",
    barWidth: "71%",
    barColor: "bg-positive",
    assets: [
      {
        ticker: "Tesouro IPCA+ 2035",
        targetPct: "20%",
        actualPct: "12%",
        deviationPct: "-8,0 p.p.",
        suggestedCents: 110000,
      },
      {
        ticker: "CDB Liquidez Diária 105% CDI",
        targetPct: "15%",
        actualPct: "13%",
        deviationPct: "-2,0 p.p.",
        suggestedCents: 30000,
      },
    ],
  },
  {
    name: "Ações Brasil & FIIs",
    targetPct: "45%",
    actualPct: "51%",
    deviationPct: "+6,0 p.p.",
    barWidth: "100%",
    barColor: "bg-cat-5",
    assets: [
      {
        ticker: "BBAS3 · Bancos",
        targetPct: "15%",
        actualPct: "14%",
        deviationPct: "-1,0 p.p.",
        suggestedCents: 60000,
      },
      {
        ticker: "HGLG11 · FII Logística",
        targetPct: "15%",
        actualPct: "17%",
        deviationPct: "+2,0 p.p.",
        suggestedCents: 0,
      },
    ],
  },
  {
    name: "Exterior (USD)",
    targetPct: "20%",
    actualPct: "24%",
    deviationPct: "+4,0 p.p.",
    barWidth: "100%",
    barColor: "bg-portfolio",
    assets: [
      {
        ticker: "IVVB11 / VOO (US$)",
        targetPct: "20%",
        actualPct: "24%",
        deviationPct: "+4,0 p.p.",
        suggestedCents: 0,
      },
    ],
  },
];

const EXTRA_CAPABILITIES = [
  {
    title: "Rentabilidade Real (TWR & TIR)",
    description:
      "Medição isolada de fluxo (TWR) e taxa interna (TIR) comparadas ao CDI e IBOV sem distorcer por aportes.",
    icon: TrendingUp,
    toneClass: "text-positive-strong",
  },
  {
    title: "Custódia Global BRL / USD",
    description:
      "Ativos no Brasil e no exterior na mesma árvore com conversão cambial transparente e visão unificada.",
    icon: Globe,
    toneClass: "text-portfolio",
  },
  {
    title: "Renda Fixa & Prévia de Resgate",
    description:
      "Cálculo automático de rendimento bruto, IOF e alíquota regressiva do título para saber o líquido na mão.",
    icon: Landmark,
    toneClass: "text-primary-strong",
  },
  {
    title: "Importação B3 & Proventos",
    description:
      "Traga posições via CSV/XLSX da B3 e acompanhe dividendos, JCP e rendimentos com calendário recorrente.",
    icon: FileSpreadsheet,
    toneClass: "text-muted-foreground",
  },
] as const;

export function InvestmentsProPreview() {
  return (
    <div data-testid="deep-dive-investments" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left: Hierarchical Allocation + Governance + Aporte Justified */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="border-border/80 bg-surface shadow-xs p-4 sm:p-5 space-y-4 rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-portfolio shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-bold text-foreground">
                  Metas Hierárquicas: Classe para Ativo
                </h3>
              </div>
              <Badge variant="portfolio" size="xs">
                Sem vender nada
              </Badge>
            </div>

            <div className="space-y-3">
              {ALLOCATION_TREE.map((group) => (
                <div
                  key={group.name}
                  className="rounded-xl border border-border/80 bg-surface-raised/50 p-3 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-foreground">{group.name}</span>
                    <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span className="text-muted-foreground">
                        Atual {group.actualPct} / Meta {group.targetPct}
                      </span>
                      <span
                        className={cn(
                          "font-bold",
                          group.deviationPct.startsWith("-")
                            ? "text-portfolio"
                            : "text-muted-foreground",
                        )}
                      >
                        {group.deviationPct}
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", group.barColor)}
                      style={{ width: group.barWidth }}
                    />
                  </div>

                  <div className="space-y-1.5 pl-2.5 border-l border-border/80">
                    {group.assets.map((asset) => (
                      <div
                        key={asset.ticker}
                        className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="font-medium text-foreground">{asset.ticker}</span>
                        <div className="flex items-center gap-2 font-mono tabular-nums">
                          <span className="text-muted-foreground">
                            {asset.actualPct} / {asset.targetPct} ({asset.deviationPct})
                          </span>
                          {asset.suggestedCents > 0 ? (
                            <span className="font-bold text-positive-strong whitespace-nowrap">
                              +<MoneyText cents={asset.suggestedCents} hideCents tone="positive" />
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Aguardar</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-positive/25 bg-positive/8 p-3 flex items-start gap-2.5">
              <Target className="size-4 text-positive-strong shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-foreground">
                  Aporte de <MoneyText cents={200000} hideCents tone="positive" /> justificado
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  70% direcionado à classe mais descontada da meta e 30% no ativo abaixo do Preço
                  Teto, reduzindo o desvio sem girar patrimônio.
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs p-4 sm:p-5 space-y-3 rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-bold text-foreground">
                  Governança & Nota de Tese
                </h3>
              </div>
              <Badge variant="positive" size="sm">
                8,8 / 10 · Tese revisada
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Registre critérios qualitativos (vantagem competitiva, dívida, governança) e notas
              próprias em cada ativo para impedir compras por impulso ou manada.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-border/80 bg-surface-raised/50 px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Checklists aprovados</span>
                <span className="font-mono font-bold text-foreground">7 / 8</span>
              </div>
              <div className="rounded-lg border border-border/80 bg-surface-raised/50 px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Status para aporte</span>
                <span className="font-semibold text-positive-strong flex items-center gap-1">
                  Liberado
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Interactive Valuation Widget */}
        <div className="lg:col-span-7">
          <ValuationInteractivePreview />
        </div>
      </div>

      {/* 4 Sober Icon-Only Mini-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {EXTRA_CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          return (
            <Card
              key={cap.title}
              className="border-border/80 bg-surface shadow-xs p-4 space-y-2 rounded-2xl"
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("size-4 shrink-0", cap.toneClass)} aria-hidden="true" />
                <h4 className="text-xs sm:text-sm font-bold text-foreground">{cap.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{cap.description}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
