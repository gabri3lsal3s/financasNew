import { useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  Calculator,
  Coins,
  FileSpreadsheet,
  FileText,
  Scale,
} from "lucide-react";
import { Badge, Card, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export type ReportPreviewKey = "dre" | "tearsheet" | "balance" | "dividends_excel";

interface ReportTabMeta {
  key: ReportPreviewKey;
  label: string;
  shortLabel: string;
  subtitle: string;
  icon: typeof BarChart3;
}

const REPORT_TABS: readonly ReportTabMeta[] = [
  {
    key: "dre",
    label: "DRE Mensal",
    shortLabel: "DRE Mensal",
    subtitle: "Fechamento do mês: receitas, despesas por categoria, taxa de poupança e sobra real.",
    icon: BarChart3,
  },
  {
    key: "tearsheet",
    label: "Lâmina Patrimonial",
    shortLabel: "Lâmina (TWR)",
    subtitle: "Tear Sheet institucional com TWR, TIR, benchmarks (CDI/IBOV) e metodologia explícita.",
    icon: FileText,
  },
  {
    key: "balance",
    label: "Balanço Consolidado",
    shortLabel: "Balanço",
    subtitle: "Ativos (Caixa + Carteira + Recebíveis) menos Passivos (Faturas + Dívidas) no mesmo painel.",
    icon: Scale,
  },
  {
    key: "dividends_excel",
    label: "Proventos & Excel (5 abas)",
    shortLabel: "Proventos & .xlsx",
    subtitle: "Termômetro de dividendos + exportação completa da vida financeira em 5 abas organizadas.",
    icon: FileSpreadsheet,
  },
];

const AUDIT_MODULES = [
  { number: "01", title: "Caixa Real & Safe-to-Spend", detail: "Saldo livre descontando compromissos" },
  { number: "02", title: "Visão Geral & Ritmo Diário", detail: "Teto diário até o fechamento do mês" },
  { number: "03", title: "Faturas & Competência", detail: "Melhor dia de compra e parcelas futuras" },
  { number: "04", title: "Dívidas & Price / SAC", detail: "Saldo devedor, juros e amortizações" },
  { number: "05", title: "Patrimônio & Alocação", detail: "Peso efetivo por classe, setor e ativo" },
  { number: "06", title: "Rentabilidade TWR & TIR", detail: "Retorno real sem distorção de aportes" },
  { number: "07", title: "Aporte & Rebalanceamento", detail: "Distribuição matemática rumo às metas" },
  { number: "08", title: "Orçamentos & Limites", detail: "Consumido vs disponível por categoria" },
  { number: "09", title: "Radar & Insights", detail: "Detecção de desvios, altas e vencimentos" },
  { number: "10", title: "Relatórios Executivos", detail: "Congruência entre DRE, Lâmina e Balanço" },
  { number: "11", title: "Finanças da Família", detail: "Rateio proporcional e acerto mensal" },
  { number: "12", title: "Viagens & Rateio em Grupo", detail: "Divisão por participante e saldos a acertar" },
] as const;

const EXCEL_SHEETS = [
  { name: "1. Resumo Executivo", desc: "KPIs de caixa, dívidas, balanço e patrimônio" },
  { name: "2. Extrato Caixa", desc: "Movimentações pagas, recebidas e competência" },
  { name: "3. Faturas & Dívidas", desc: "Cronograma de parcelas e contratos Price/SAC" },
  { name: "4. Posição de Carteira", desc: "Ativos BRL/USD, preço médio, metas e desvio" },
  { name: "5. Proventos", desc: "Histórico mensal de dividendos, JCP e FIIs" },
] as const;

export function ReportsSuitePreview() {
  const [selectedReport, setSelectedReport] = useState<ReportPreviewKey>("dre");
  const currentMeta = REPORT_TABS.find((item) => item.key === selectedReport) ?? REPORT_TABS[0]!;

  const handleSelectReport = (key: ReportPreviewKey) => {
    triggerSensory("selection");
    setSelectedReport(key);
  };

  return (
    <div data-testid="deep-dive-reports" className="space-y-6">
      <Card className="border-border/80 bg-surface shadow-xs p-4 sm:p-6 space-y-5 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Suíte de Relatórios Executivos & Exportação Real
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">{currentMeta.subtitle}</p>
          </div>
          <Badge variant="default" size="sm">
            PDF & Excel (.xlsx) incluídos
          </Badge>
        </div>

        {/* Report Switcher */}
        <div
          role="group"
          aria-label="Selecionar modelo de relatório"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {REPORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedReport === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelectReport(tab.key)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer flex items-center gap-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary/40 bg-primary/10 text-foreground shadow-xs"
                    : "border-border/80 bg-surface-raised/50 text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isSelected ? "text-primary-strong" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold leading-tight">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Report Preview Surface */}
        {selectedReport === "dre" ? (
          <div
            data-testid="report-preview-dre"
            className="rounded-xl border border-border/80 bg-surface-raised/50 p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                DRE Mensal — Fechamento Financeiro (Competência Real)
              </span>
              <Badge variant="positive" size="xs">
                Taxa de poupança: 29,5%
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
                <span className="text-[11px] text-muted-foreground block">Receitas Líquidas</span>
                <MoneyText cents={940000} tone="positive" className="text-base sm:text-lg font-bold" />
              </div>
              <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
                <span className="text-[11px] text-muted-foreground block">Despesas Totais</span>
                <MoneyText cents={-662000} tone="negative" className="text-base sm:text-lg font-bold" />
              </div>
              <div className="rounded-xl border border-positive/30 bg-positive/8 p-3 space-y-1">
                <span className="text-[11px] font-semibold text-positive-strong block">
                  Resultado Líquido (Sobra)
                </span>
                <MoneyText cents={278000} tone="positive" className="text-base sm:text-lg font-extrabold" />
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar scroll-smooth w-full rounded-xl border border-border/80 bg-surface">
              <table className="w-full min-w-[440px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 bg-surface-raised/70 text-[11px] font-semibold text-muted-foreground">
                    <th className="py-2 px-3">Grupo da DRE</th>
                    <th className="py-2 px-3 text-right">Realizado</th>
                    <th className="py-2 px-3 text-right">% da Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="py-2 px-3 font-medium text-foreground">Moradia & Contas Fixas</td>
                    <td className="py-2 px-3 text-right">
                      <MoneyText cents={285000} tone="default" />
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">30,3%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium text-foreground">Alimentação, Cartões & Dia a Dia</td>
                    <td className="py-2 px-3 text-right">
                      <MoneyText cents={262000} tone="default" />
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">27,9%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium text-foreground">Parcelas & Dívidas Programadas</td>
                    <td className="py-2 px-3 text-right">
                      <MoneyText cents={115000} tone="default" />
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">12,2%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {selectedReport === "tearsheet" ? (
          <div
            data-testid="report-preview-tearsheet"
            className="rounded-xl border border-border/80 bg-surface-raised/50 p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                Lâmina Patrimonial — Tear Sheet Auditado (A4 Pronto para Impressão)
              </span>
              <Badge variant="portfolio" size="xs">
                TWR vs CDI & IBOV
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
                <span className="text-[11px] text-muted-foreground block">Patrimônio em Carteira</span>
                <MoneyText cents={18450000} tone="portfolio" className="text-base sm:text-lg font-bold" />
              </div>
              <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
                <span className="text-[11px] text-muted-foreground block">Rentabilidade TWR (24m)</span>
                <span className="font-mono text-base sm:text-lg font-bold text-positive-strong whitespace-nowrap">
                  +28,4% (+13,3% a.a.)
                </span>
              </div>
              <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
                <span className="text-[11px] text-muted-foreground block">CDI no mesmo período</span>
                <span className="font-mono text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
                  +22,1% (Alpha +6,3 p.p.)
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-1.5 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <BookOpenCheck className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
                Bloco de Metodologia em Linguagem Clara
              </span>
              <p className="text-muted-foreground leading-relaxed">
                Cada Lâmina explica a cota patrimonial diária (TWR), o fluxo ponderado (TIR) e a
                conciliação contábil entre saldo inicial, aportes líquidos, proventos e variação de
                mercado — sem divergência silenciosa.
              </p>
            </div>
          </div>
        ) : null}

        {selectedReport === "balance" ? (
          <div
            data-testid="report-preview-balance"
            className="rounded-xl border border-border/80 bg-surface-raised/50 p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                Balanço Patrimonial Consolidado — Ativos vs Passivos
              </span>
              <Badge variant="positive" size="xs">
                Liquidez saudável
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-2">
                <span className="text-[11px] font-semibold text-positive-strong block">
                  Ativos Totais
                </span>
                <MoneyText cents={20210000} tone="positive" className="text-base sm:text-lg font-bold" />
                <p className="text-[11px] text-muted-foreground">
                  Caixa (<MoneyText cents={1420000} hideCents />) + Carteira (
                  <MoneyText cents={18450000} hideCents />) + A Receber (
                  <MoneyText cents={340000} hideCents />)
                </p>
              </div>
              <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-2">
                <span className="text-[11px] font-semibold text-negative-strong block">
                  Passivos Totais
                </span>
                <MoneyText cents={-3680000} tone="negative" className="text-base sm:text-lg font-bold" />
                <p className="text-[11px] text-muted-foreground">
                  Faturas futuras (<MoneyText cents={480000} hideCents />) + Dívidas &amp; Contratos (
                  <MoneyText cents={3200000} hideCents />)
                </p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/8 p-3.5 space-y-2">
                <span className="text-[11px] font-semibold text-primary-strong block">
                  Patrimônio Líquido Real
                </span>
                <MoneyText cents={16530000} tone="default" className="text-base sm:text-lg font-extrabold" />
                <p className="text-[11px] text-muted-foreground">
                  Visão verdadeira após descontar todas as obrigações assumidas.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {selectedReport === "dividends_excel" ? (
          <div
            data-testid="report-preview-dividends"
            className="rounded-xl border border-border/80 bg-surface-raised/50 p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                Termômetro de Proventos & Dossiê Completo em Excel (.xlsx)
              </span>
              <Badge variant="portfolio" size="xs">
                5 abas padronizadas
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Coins className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
                  <span>Bola de Neve de Renda Passiva</span>
                </div>
                <MoneyText cents={124500} tone="positive" className="text-base sm:text-lg font-bold" />
                <span className="text-[11px] text-muted-foreground block">
                  Média mensal de proventos (Dividendos + JCP + FIIs) · YoC 9,4% a.a.
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-2">
                <span className="text-xs font-semibold text-foreground block">
                  Estrutura do arquivo Excel (.xlsx) em 1 clique:
                </span>
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {EXCEL_SHEETS.map((sheet) => (
                    <li key={sheet.name} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-foreground">{sheet.name}:</span>
                      <span>{sheet.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Memória de Cálculo em 12 Módulos */}
      <Card className="border-border/80 bg-surface shadow-xs p-4 sm:p-6 space-y-4 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Zero Caixa Preta — Memória de Cálculo em 12 Módulos
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Cada indicador do app abre fórmula, entradas e saldo passo a passo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {AUDIT_MODULES.map((mod) => (
            <div
              key={mod.number}
              className="rounded-xl border border-border/80 bg-surface-raised/50 p-3 space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-primary-strong">
                  {mod.number}
                </span>
                <span className="text-xs font-semibold text-foreground">{mod.title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{mod.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
